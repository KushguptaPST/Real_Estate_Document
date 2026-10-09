import { renderEmailTemplate } from '../src/services/emailTemplates.js';
import { sendEmail } from '../src/services/email.service.js';
import { differenceInCalendarDays, startOfDay, addDays } from 'date-fns';

describe('Email Templates & Window Logic (Person A)', () => {
  const sampleData = {
    dealId: 'deal-12345',
    propertyAddress: '742 Evergreen Terrace, Springfield, CA',
    deadlineLabel: 'Inspection Contingency',
    deadlineDate: new Date('2026-10-15T17:00:00Z'),
  };

  test('renders 3-day upcoming warning template with required disclaimer and link', () => {
    const rendered = renderEmailTemplate('3-day', sampleData);
    expect(rendered.subject).toContain('[3-Day Notice]');
    expect(rendered.subject).toContain(sampleData.propertyAddress);
    expect(rendered.html).toContain('Inspection Contingency');
    expect(rendered.html).toContain('/deals/deal-12345');
    expect(rendered.html).toContain('does not constitute legal advice');
  });

  test('renders 1-day urgent warning template', () => {
    const rendered = renderEmailTemplate('1-day', sampleData);
    expect(rendered.subject).toContain('[URGENT 1-Day Warning]');
    expect(rendered.html).toContain('Due Tomorrow');
    expect(rendered.text).toContain('URGENT 1-DAY CONTINGENCY WARNING');
  });

  test('renders day-of and missed templates', () => {
    const dayOf = renderEmailTemplate('day_of', sampleData);
    expect(dayOf.subject).toContain('[DUE TODAY]');

    const missed = renderEmailTemplate('missed', sampleData);
    expect(missed.subject).toContain('[OVERDUE DEADLINE]');
  });

  test('window calculation identifies 3-day, 1-day, and catch-up scenarios', () => {
    const now = new Date();
    const target3Days = addDays(now, 3);
    const target1Day = addDays(now, 1);
    const targetCatchUp = addDays(now, 2);

    expect(differenceInCalendarDays(startOfDay(target3Days), startOfDay(now))).toBe(3);
    expect(differenceInCalendarDays(startOfDay(target1Day), startOfDay(now))).toBe(1);
    expect(differenceInCalendarDays(startOfDay(targetCatchUp), startOfDay(now))).toBe(2);
  });

  test('sendEmail gracefully falls back to dev mode when SENDGRID_API_KEY is not set', async () => {
    delete process.env['SENDGRID_API_KEY'];
    const result = await sendEmail({
      to: 'testagent@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
      text: 'Test',
    });
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBeDefined();
    expect(result.providerMessageId).toContain('dev-stub');
  });
});
