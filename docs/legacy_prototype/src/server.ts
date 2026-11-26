import express, { Request, Response } from 'express';
import 'dotenv/config';
import { extractDeadlines } from './extraction.js';
import { computeDeadline } from './dateEngine.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.post('/extract', async (req: Request, res: Response) => {
  try {
    const { contractText } = req.body;

    if (!contractText || typeof contractText !== 'string') {
      return res.status(400).json({ error: 'contractText is required' });
    }

    const result = await extractDeadlines(contractText);

    const acceptanceDate = new Date(result.acceptance_date);
    const deadlinesWithDates = result.deadlines.map(d => ({
      ...d,
      computed_deadline: computeDeadline(
        acceptanceDate,
        d.number_of_days,
        d.day_type,
        'US',
        'CA'
      ),
    }));

    res.json({
      acceptance_date: result.acceptance_date,
      deadlines: deadlinesWithDates,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Extraction failed', details: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});