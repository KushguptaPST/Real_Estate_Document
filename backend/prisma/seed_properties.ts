import { PrismaClient, PropertyStatus } from '@prisma/client';

const prisma = new PrismaClient();

const ORGANIZATIONS = ['cmuyc3rxl0001xj888pzcoyop', 'demo-sandbox-org'];

const BENGALURU_PROPERTIES = [
  {
    title: 'Prestige Shantiniketan — Highline 3BHK Residence',
    address: 'Tower 14, ITPL Main Road, Whitefield',
    city: 'Whitefield, Bengaluru (Bangalore)',
    price: 21500000, // ₹2.15 Cr
    bedrooms: 3,
    bathrooms: 3,
    propertyType: 'APARTMENT',
    status: PropertyStatus.AVAILABLE,
    possessionDate: new Date('2024-01-01'),
    features: [
      'Ready to Move',
      '1930 sq ft Super Built-Up',
      'High Floor with Unobstructed Views',
      'Modular Italian Kitchen',
      'Clubhouse & Olympic Lap Pool',
      '5-min walk to ITPL Metro Station',
      '2 Covered Parking Slots',
    ],
    description:
      'Impeccably maintained ready-to-move 3BHK residence in Prestige Shantiniketan, the flagship integrated township in Whitefield. Features 1,930 sq.ft. of carpet/super built-up, premium marble finishes, piped gas, and direct walking distance to ITPL and the Purple Line Metro.',
  },
  {
    title: 'Godrej Splendour — Park-Facing 3BHK Smart Home',
    address: 'Belathur Main Road, Whitefield Corridor',
    city: 'Whitefield, Bengaluru (Bangalore)',
    price: 14800000, // ₹1.48 Cr
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'APARTMENT',
    status: PropertyStatus.AVAILABLE,
    possessionDate: new Date('2026-12-01'),
    features: [
      'Under Construction (Possession Dec 2026)',
      '1529 sq ft Carpet Area',
      '85% Open Green Landscaping',
      'Integrated Smart Home Automation',
      'Grand Clubhouse with 50+ Lifestyle Amenities',
      'Close to Hope Farm Junction & Kadugodi Metro',
    ],
    description:
      'Contemporary 3BHK home at Godrej Splendour in the high-growth Belathur-Whitefield corridor. 1,529 sq.ft., expansive balconies, luxury clubhouse, EV charging bays, and superior long-term rental yield potential for tech professionals.',
  },
  {
    title: 'Sobha Sentosa — Ultra-Luxury 3BHK Pent-Style Residence',
    address: 'Panathur Main Road, Whitefield-ORR Corridor',
    city: 'Whitefield, Bengaluru (Bangalore)',
    price: 26500000, // ₹2.65 Cr
    bedrooms: 3,
    bathrooms: 3,
    propertyType: 'APARTMENT',
    status: PropertyStatus.AVAILABLE,
    possessionDate: new Date('2026-06-01'),
    features: [
      'Possession Mid-2026',
      '2050 sq ft Super Built-Up',
      'Signature German Engineered Precision',
      'Imported Botticino Marble',
      'Panoramic Balcony with Green Vistas',
      'Resort-Style Floating Clubhouse',
    ],
    description:
      'Exquisite super-luxury 3BHK residence crafted with Sobha signature precast and German finishing standards. 2,050 sq.ft. with sprawling living-dining layout, private entry foyer, acoustic double-glazed windows, and seamless access to both Whitefield and Bellandur tech hubs.',
  },
  {
    title: 'Brigade Woods — Low-Rise Boutique Garden 3BHK',
    address: 'ECC Road, Whitefield',
    city: 'Whitefield, Bengaluru (Bangalore)',
    price: 18500000, // ₹1.85 Cr
    bedrooms: 3,
    bathrooms: 3,
    propertyType: 'APARTMENT',
    status: PropertyStatus.AVAILABLE,
    possessionDate: new Date('2024-06-01'),
    features: [
      'Ready to Move',
      '1760 sq ft',
      'Low-Rise Boutique Gated Enclave (G+4)',
      'Mature Tree Canopy & Woods Architecture',
      'Walking Distance to Vydehi Hospital & Metro',
      'Peaceful Residential Enclave',
    ],
    description:
      'Rare low-rise boutique 3BHK nestled in the lush, tranquil tree canopy of ECC Road, Whitefield. 1,760 sq.ft. with serene private sit-out, top-tier privacy, and immediate move-in readiness away from main road congestion.',
  },
];

async function main() {
  console.log('Seeding verified Bengaluru inventory across organizations...');

  for (const orgId of ORGANIZATIONS) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      console.log(`Skipping missing org: ${orgId}`);
      continue;
    }

    for (const prop of BENGALURU_PROPERTIES) {
      const existing = await prisma.property.findFirst({
        where: {
          organizationId: orgId,
          title: prop.title,
        },
      });

      if (!existing) {
        const created = await prisma.property.create({
          data: {
            ...prop,
            organizationId: orgId,
          },
        });
        console.log(`Created property: "${created.title}" in org ${org.name} (${orgId})`);
      } else {
        const updated = await prisma.property.update({
          where: { id: existing.id },
          data: {
            ...prop,
            organizationId: orgId,
          },
        });
        console.log(`Updated property: "${updated.title}" in org ${org.name} (${orgId})`);
      }
    }
  }

  console.log('Bengaluru property seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
