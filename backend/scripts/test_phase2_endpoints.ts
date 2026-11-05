import { createApp } from '../src/app.js';
import request from 'supertest';
import { prisma } from '../src/utils/prisma.js';
import { verifyPassword } from '../src/services/auth.service.js';

async function main() {
  console.log('🚀 [Phase 2 Test] Starting end-to-end verification of Phase 2...');
  const app = createApp();

  const testEmail = `broker.test.${Date.now()}@vanceproperties.com`;
  const testPassword = 'SecurePassword2026!';
  let orgId = '';
  let token = '';

  try {
    // 1. Test POST /api/auth/register-org
    console.log('\n--- Test 1: POST /api/auth/register-org ---');
    const regRes = await request(app).post('/api/auth/register-org').send({
      ownerName: 'Marcus Vance',
      email: testEmail,
      password: testPassword,
      organizationName: 'Vance Luxury Properties',
      stateJurisdiction: 'CA',
      planTier: 'SOLO',
    });

    if (regRes.status !== 201) {
      throw new Error(`Registration failed with status ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    }

    console.log('✅ Registration successful: HTTP 201');
    console.log('   User:', regRes.body.user.name, `(${regRes.body.user.email})`);
    console.log('   Role:', regRes.body.user.role);
    console.log('   Org:', regRes.body.organization.name, `[State: ${regRes.body.organization.stateJurisdiction}, Tier: ${regRes.body.organization.subscriptionTier}]`);
    
    orgId = regRes.body.organization.id;
    token = regRes.body.token;

    // Verify DB password hashing
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!dbUser || !dbUser.passwordHash) throw new Error('DB user or passwordHash missing');
    if (!verifyPassword(testPassword, dbUser.passwordHash)) throw new Error('Password hash verification failed');
    console.log('✅ Password securely hashed and verified with scrypt salt');

    // 2. Test POST /api/auth/login
    console.log('\n--- Test 2: POST /api/auth/login ---');
    const loginFail = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword!',
    });
    if (loginFail.status !== 401) throw new Error('Failed to reject bad password');
    console.log('✅ Rejected incorrect password: HTTP 401');

    const loginSuccess = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    if (loginSuccess.status !== 200 || !loginSuccess.body.token) throw new Error('Failed valid login');
    console.log('✅ Successful password authentication: HTTP 200');

    // 3. Test GET /api/billing/subscription
    console.log('\n--- Test 3: GET /api/billing/subscription ---');
    const subRes = await request(app)
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${token}`);

    if (subRes.status !== 200) throw new Error(`Subscription fetch failed: ${subRes.status}`);
    console.log('✅ Subscription fetched: HTTP 200');
    console.log('   Plan Name:', subRes.body.planDetails.name);
    console.log('   Max Escrows:', subRes.body.usage.maxDeals ?? 'Unlimited');
    console.log('   Max Seats:', subRes.body.usage.maxSeats);

    // 4. Test POST /api/billing/create-checkout-session
    console.log('\n--- Test 4: POST /api/billing/create-checkout-session ---');
    const checkoutRes = await request(app)
      .post('/api/billing/create-checkout-session')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'TEAM', isAnnual: true });

    if (checkoutRes.status !== 200 || !checkoutRes.body.url) throw new Error('Checkout session creation failed');
    console.log('✅ Checkout session created: HTTP 200');
    console.log('   Checkout URL:', checkoutRes.body.url);

    // 5. Test POST /api/billing/dev-upgrade
    console.log('\n--- Test 5: POST /api/billing/dev-upgrade ---');
    const upgradeRes = await request(app)
      .post('/api/billing/dev-upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'TEAM' });

    if (upgradeRes.status !== 200 || upgradeRes.body.subscriptionTier !== 'TEAM') throw new Error('Dev upgrade failed');
    console.log('✅ Upgraded to TEAM tier in sandbox: HTTP 200');

    const updatedSub = await request(app)
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${token}`);

    console.log('   Updated Tier:', updatedSub.body.tier);
    console.log('   Updated Max Seats:', updatedSub.body.usage.maxSeats);
    console.log('   Updated Deal Limit:', updatedSub.body.usage.maxDeals ?? 'Unlimited');

    console.log('\n🎉 ALL PHASE 2 BACKEND ENDPOINTS AND SECURITY CHECKS PASSED!');
  } finally {
    if (orgId) {
      await prisma.user.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
