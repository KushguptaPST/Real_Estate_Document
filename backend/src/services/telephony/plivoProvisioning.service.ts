// ─────────────────────────────────────────────────────────────────────────────
// Plivo Subaccount, India Compliance KYC & DID Provisioning Service
// Handles multi-tenant telephony isolation under the platform's master Plivo
// account so brokerages never register or pay Plivo directly.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { getOrCreateOrgChannel } from '../channelRegistry.service.js';
import { sanitizeE164Phone } from './plivo.service.js';

function getMasterCredentials() {
  return {
    authId: process.env['PLIVO_AUTH_ID'],
    authToken: process.env['PLIVO_AUTH_TOKEN'],
  };
}

export async function provisionSubaccountForOrg(organizationId: string, orgName: string) {
  const channel = await getOrCreateOrgChannel(organizationId);
  if (channel.plivoSubaccountId) {
    return {
      subaccountId: channel.plivoSubaccountId,
      isSimulated: channel.plivoSubaccountId.startsWith('sub_sim_'),
    };
  }

  const { authId, authToken } = getMasterCredentials();
  if (!authId || !authToken) {
    const simId = `sub_sim_${organizationId.slice(-8)}_${Date.now().toString(36)}`;
    await prisma.organizationChannel.update({
      where: { organizationId },
      data: { plivoSubaccountId: simId },
    });
    logger.info(`[Plivo Provisioning] Created sandbox subaccount ${simId} for org ${organizationId}`);
    return { subaccountId: simId, isSimulated: true };
  }

  const authHeader = 'Basic ' + Buffer.from(`${authId}:${authToken}`).toString('base64');
  const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/Subaccount/`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `${orgName.slice(0, 40)} (${organizationId.slice(-6)})`,
      enabled: true,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = (await res.json()) as { auth_id?: string; message?: string; error?: string };
  if (!res.ok || !data.auth_id) {
    throw new Error(data.error || data.message || `Plivo subaccount creation failed (${res.status})`);
  }

  await prisma.organizationChannel.update({
    where: { organizationId },
    data: { plivoSubaccountId: data.auth_id },
  });

  logger.info(`[Plivo Provisioning] Created live Plivo subaccount ${data.auth_id} for org ${organizationId}`);
  return { subaccountId: data.auth_id, isSimulated: false };
}

export interface IndiaKycSubmissionInput {
  legalEntityName: string;
  documentType: 'GST_CERTIFICATE' | 'COI' | 'UDYAM';
  registrationNumber: string;
  authorizedSignatoryName: string;
  businessAddress: string;
  city: string;
  documentUrl?: string;
}

export async function submitIndiaComplianceKyc(
  organizationId: string,
  input: IndiaKycSubmissionInput,
) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error('Organization not found');

  const sub = await provisionSubaccountForOrg(organizationId, org.name);
  const { authId, authToken } = getMasterCredentials();

  if (!authId || !authToken) {
    const appId = `kyc_sim_${Date.now().toString(36)}`;
    await prisma.organizationChannel.update({
      where: { organizationId },
      data: {
        plivoComplianceAppId: appId,
        plivoComplianceStatus: 'ACCEPTED',
      },
    });
    return {
      complianceApplicationId: appId,
      status: 'ACCEPTED' as const,
      subaccountId: sub.subaccountId,
      isSimulated: true,
    };
  }

  const authHeader = 'Basic ' + Buffer.from(`${authId}:${authToken}`).toString('base64');
  const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/PhoneNumber/Compliance/`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      alias: `${input.legalEntityName} - ${input.city}`,
      country_iso2: 'IN',
      number_type: 'local',
      user_type: 'business',
      subaccount: sub.subaccountId,
      documents: [
        {
          document_type: input.documentType,
          registration_number: input.registrationNumber,
          legal_name: input.legalEntityName,
          signatory_name: input.authorizedSignatoryName,
          address: input.businessAddress,
          ...(input.documentUrl ? { document_url: input.documentUrl } : {}),
        },
      ],
    }),
    signal: AbortSignal.timeout(12000),
  });

  const data = (await res.json()) as { compliance_id?: string; status?: string; error?: string; message?: string };
  if (!res.ok || !data.compliance_id) {
    throw new Error(data.error || data.message || `Plivo compliance submission failed (${res.status})`);
  }

  const status = (data.status || 'PENDING').toUpperCase();
  await prisma.organizationChannel.update({
    where: { organizationId },
    data: {
      plivoComplianceAppId: data.compliance_id,
      plivoComplianceStatus: status,
    },
  });

  return {
    complianceApplicationId: data.compliance_id,
    status,
    subaccountId: sub.subaccountId,
    isSimulated: false,
  };
}

export async function provisionDidForOrg(
  organizationId: string,
  params: { phoneNumber?: string; city: string; alias?: string },
) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error('Organization not found');

  const channel = await getOrCreateOrgChannel(organizationId);
  const sub = await provisionSubaccountForOrg(organizationId, org.name);
  const { authId, authToken } = getMasterCredentials();

  // Generate or sanitize requested DID
  const candidateNumber = params.phoneNumber
    ? sanitizeE164Phone(params.phoneNumber)
    : `+91804568${Math.floor(1000 + Math.random() * 8999)}`;

  let isSimulated = true;
  if (authId && authToken && channel.plivoComplianceAppId) {
    const authHeader = 'Basic ' + Buffer.from(`${authId}:${authToken}`).toString('base64');
    const cleanDigits = candidateNumber.replace(/[^\d]/g, '');
    const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/PhoneNumber/${cleanDigits}/`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subaccount: sub.subaccountId,
        compliance_application_id: channel.plivoComplianceAppId,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as any;
      throw new Error(data.error || data.message || `Plivo DID provisioning failed (${res.status})`);
    }
    isSimulated = false;
  }

  await prisma.plivoNumber.updateMany({
    where: { organizationId, isPrimary: true },
    data: { isPrimary: false },
  });

  const record = await prisma.plivoNumber.upsert({
    where: { phoneNumber: candidateNumber },
    create: {
      organizationId,
      phoneNumber: candidateNumber,
      city: params.city,
      plivoAlias: params.alias || `${org.name} Primary Line`,
      isActive: true,
      isPrimary: true,
    },
    update: {
      organizationId,
      city: params.city,
      isActive: true,
      isPrimary: true,
    },
  });

  return {
    number: record,
    subaccountId: sub.subaccountId,
    isSimulated,
    callForwardingCode: `*21*${record.phoneNumber}#`,
  };
}
