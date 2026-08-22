#!/usr/bin/env ts-node
/**
 * Generate test fixtures for local development and E2E testing
 * Usage: npx ts-node scripts/generate-fixtures.ts [--output path]
 */

import * as fs from 'fs';
import * as path from 'path';

interface CampaignFixture {
  id: string;
  title: string;
  description: string;
  creator: string;
  goal: number;
  deadline: number;
  minContribution: number;
  maxContribution: number;
  status: 'Active' | 'Funded' | 'Failed' | 'Refunding' | 'Paused' | 'Cancelled';
  category: 'Environment' | 'Health' | 'Education' | 'Technology' | 'Arts' | 'Community' | 'Other';
  currentTotal: number;
  contributorCount: number;
  progress: number;
  state: string;
  socialLinks?: string[];
  imageUrl?: string;
  tags?: string[];
}

interface ContributorFixture {
  address: string;
  name: string;
  totalContributed: number;
  campaignsSupported: number;
  avatar?: string;
}

interface ContributionFixture {
  campaignId: string;
  contributor: string;
  amount: number;
  timestamp: number;
  message?: string;
  anonymous: boolean;
}

interface TestFixtures {
  generated: string;
  campaigns: CampaignFixture[];
  contributors: ContributorFixture[];
  contributions: ContributionFixture[];
  metadata: {
    totalCampaigns: number;
    totalContributors: number;
    totalContributions: number;
    totalRaised: number;
  };
}

// Helper to generate deterministic but realistic addresses
function generateAddress(seed: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = 'G';
  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    result += chars[code % chars.length];
  }
  while (result.length < 56) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result.substring(0, 56);
}

// Helper to generate contract ID
function generateContractId(index: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = 'C';
  for (let i = 0; i < 10; i++) {
    result += chars[(index + i) % chars.length];
  }
  while (result.length < 56) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result.substring(0, 56);
}

// Get timestamps
const now = Math.floor(Date.now() / 1000);
const day = 86400;
const month = day * 30;

// Campaign templates
const campaignTemplates: Omit<CampaignFixture, 'id' | 'creator' | 'progress'>[] = [
  {
    title: 'Save the Rainforest',
    description: 'Help protect endangered species and their habitats in the Amazon rainforest. Every contribution goes toward conservation efforts.',
    goal: 10_000_000_000, // 1000 XLM
    deadline: now + month,
    minContribution: 1_000_000, // 0.1 XLM
    maxContribution: 0,
    status: 'Active',
    category: 'Environment',
    currentTotal: 500_000_000, // 50 XLM (5%)
    contributorCount: 12,
    state: 'Active (New)',
    socialLinks: ['https://twitter.com/rainforest', 'https://example.com/rainforest'],
    imageUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800',
    tags: ['environment', 'conservation', 'wildlife'],
  },
  {
    title: 'Clean Ocean Initiative',
    description: 'Remove plastic waste from our oceans and protect marine life. Join us in making a difference for future generations.',
    goal: 5_000_000_000, // 500 XLM
    deadline: now + month,
    minContribution: 500_000, // 0.05 XLM
    maxContribution: 0,
    status: 'Active',
    category: 'Environment',
    currentTotal: 3_000_000_000, // 300 XLM (60%)
    contributorCount: 45,
    state: 'Active (Mid-Progress)',
    socialLinks: ['https://twitter.com/cleanocean'],
    imageUrl: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800',
    tags: ['ocean', 'cleanup', 'sustainability'],
  },
  {
    title: 'Community Library Fund',
    description: 'Build a modern library for our local community with books, computers, and learning resources for all ages.',
    goal: 2_000_000_000, // 200 XLM
    deadline: now + month,
    minContribution: 100_000, // 0.01 XLM
    maxContribution: 0,
    status: 'Active',
    category: 'Education',
    currentTotal: 1_950_000_000, // 195 XLM (97.5%)
    contributorCount: 156,
    state: 'Active (Near Goal)',
    imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800',
    tags: ['education', 'community', 'library'],
  },
  {
    title: 'Solar Panel Installation',
    description: 'Install solar panels on our community center to reduce energy costs and carbon footprint.',
    goal: 3_000_000_000, // 300 XLM
    deadline: now - month, // Past deadline
    minContribution: 200_000, // 0.02 XLM
    maxContribution: 0,
    status: 'Funded',
    category: 'Environment',
    currentTotal: 3_500_000_000, // 350 XLM (116%)
    contributorCount: 89,
    state: 'Fully Funded',
    imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800',
    tags: ['solar', 'renewable', 'green-energy'],
  },
  {
    title: 'Mobile App Development',
    description: 'Create an educational mobile app for students to learn coding and computer science fundamentals.',
    goal: 8_000_000_000, // 800 XLM
    deadline: now - 2 * month, // Expired
    minContribution: 500_000, // 0.05 XLM
    maxContribution: 0,
    status: 'Failed',
    category: 'Technology',
    currentTotal: 2_000_000_000, // 200 XLM (25%)
    contributorCount: 34,
    state: 'Failed (Expired)',
    imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800',
    tags: ['education', 'technology', 'mobile-app'],
  },
  {
    title: 'Wildlife Sanctuary',
    description: 'Create a safe haven for rescued wildlife with proper medical care, rehabilitation, and eventual release.',
    goal: 15_000_000_000, // 1500 XLM
    deadline: now + 2 * month,
    minContribution: 1_000_000, // 0.1 XLM
    maxContribution: 0,
    status: 'Active',
    category: 'Environment',
    currentTotal: 500_000_000, // 50 XLM (3.3%)
    contributorCount: 8,
    state: 'Active (Early Stage)',
    imageUrl: 'https://images.unsplash.com/photo-1564760055775-d63b17a55c44?w=800',
    tags: ['wildlife', 'rescue', 'animals'],
  },
  {
    title: 'Medical Equipment Fund',
    description: 'Purchase essential medical equipment for our local clinic to provide better healthcare services.',
    goal: 4_000_000_000, // 400 XLM
    deadline: now - 2 * month, // Expired, below goal
    minContribution: 300_000, // 0.03 XLM
    maxContribution: 0,
    status: 'Refunding',
    category: 'Health',
    currentTotal: 1_500_000_000, // 150 XLM (37.5%)
    contributorCount: 56,
    state: 'Refunding',
    imageUrl: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=800',
    tags: ['health', 'medical', 'equipment'],
  },
  {
    title: 'Art Gallery Opening',
    description: 'Launch a contemporary art gallery showcasing local artists and providing community art workshops.',
    goal: 6_000_000_000, // 600 XLM
    deadline: now + month,
    minContribution: 250_000, // 0.025 XLM
    maxContribution: 0,
    status: 'Active',
    category: 'Arts',
    currentTotal: 400_000_000, // 40 XLM (6.7%)
    contributorCount: 23,
    state: 'Active (Low Progress)',
    imageUrl: 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=800',
    tags: ['arts', 'gallery', 'community'],
  },
  {
    title: 'Emergency Relief Fund',
    description: 'Provide emergency relief to disaster victims including food, water, shelter, and medical supplies.',
    goal: 12_000_000_000, // 1200 XLM
    deadline: now + day, // 1 day left
    minContribution: 500_000, // 0.05 XLM
    maxContribution: 0,
    status: 'Active',
    category: 'Health',
    currentTotal: 11_000_000_000, // 1100 XLM (91.7%)
    contributorCount: 234,
    state: 'Near Deadline (Active)',
    imageUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
    tags: ['emergency', 'relief', 'humanitarian'],
  },
  {
    title: 'Tech Startup Seed',
    description: 'Launch an innovative tech startup focused on sustainable agriculture using IoT and AI technologies.',
    goal: 20_000_000_000, // 2000 XLM
    deadline: now + 2 * month,
    minContribution: 1_000_000, // 0.1 XLM
    maxContribution: 0,
    status: 'Paused',
    category: 'Technology',
    currentTotal: 8_000_000_000, // 800 XLM (40%)
    contributorCount: 67,
    state: 'Paused',
    imageUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800',
    tags: ['technology', 'startup', 'agriculture'],
  },
];

// Generate contributor fixtures
const contributorNames = [
  'Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince',
  'Ethan Hunt', 'Fiona Green', 'George Wilson', 'Hannah Lee',
  'Ian Malcolm', 'Julia Roberts', 'Kevin Hart', 'Laura Palmer',
];

const contributors: ContributorFixture[] = contributorNames.map((name, index) => ({
  address: generateAddress(name),
  name,
  totalContributed: Math.floor(Math.random() * 5_000_000_000) + 100_000_000,
  campaignsSupported: Math.floor(Math.random() * 5) + 1,
  avatar: `https://i.pravatar.cc/150?u=${index}`,
}));

// Generate campaigns with IDs and creators
const creator = generateAddress('creator');
const campaigns: CampaignFixture[] = campaignTemplates.map((template, index) => ({
  ...template,
  id: generateContractId(index),
  creator,
  progress: Math.round((template.currentTotal / template.goal) * 100),
}));

// Generate contributions
const contributions: ContributionFixture[] = [];
campaigns.forEach((campaign) => {
  const numContributions = Math.floor(campaign.contributorCount * 1.5); // Some contributors contribute multiple times
  
  for (let i = 0; i < numContributions; i++) {
    const contributor = contributors[Math.floor(Math.random() * contributors.length)];
    const amount = Math.floor(
      (campaign.currentTotal / campaign.contributorCount) *
      (0.5 + Math.random())
    );
    
    contributions.push({
      campaignId: campaign.id,
      contributor: contributor.address,
      amount,
      timestamp: campaign.deadline - Math.floor(Math.random() * month),
      message: Math.random() > 0.7 ? 'Great cause! Happy to support.' : undefined,
      anonymous: Math.random() > 0.8,
    });
  }
});

// Calculate metadata
const totalRaised = campaigns.reduce((sum, c) => sum + c.currentTotal, 0);

const fixtures: TestFixtures = {
  generated: new Date().toISOString(),
  campaigns,
  contributors,
  contributions,
  metadata: {
    totalCampaigns: campaigns.length,
    totalContributors: contributors.length,
    totalContributions: contributions.length,
    totalRaised,
  },
};

// Parse CLI arguments
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 && args[outputIndex + 1]
  ? args[outputIndex + 1]
  : 'fixtures/test-fixtures.json';

// Ensure fixtures directory exists
const fixturesDir = path.dirname(outputPath);
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Write fixtures to file
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2), 'utf-8');

// Ensure multi-currency donation scenario fixtures exist alongside standard fixtures
const multiCurrencyPath = path.join(fixturesDir, 'multi-currency-donations.json');
if (!fs.existsSync(multiCurrencyPath)) {
  const multiCurrencyData = {
    description: "Multi-currency donation test scenarios",
    supportedCurrencies: [
      { code: "XLM", symbol: "𐤀", decimals: 7, isNative: true, usdExchangeRate: 0.12 },
      { code: "USDC", symbol: "$", decimals: 7, isNative: false, usdExchangeRate: 1.0 },
      { code: "EURC", symbol: "€", decimals: 7, isNative: false, usdExchangeRate: 1.08 },
      { code: "BTC", symbol: "₿", decimals: 8, isNative: false, usdExchangeRate: 65000.0 },
      { code: "ETH", symbol: "Ξ", decimals: 18, isNative: false, usdExchangeRate: 3400.0 }
    ],
    scenarios: []
  };
  fs.writeFileSync(multiCurrencyPath, JSON.stringify(multiCurrencyData, null, 2), 'utf-8');
}

console.log('✓ Test fixtures generated successfully!');
console.log(`  Output: ${outputPath}`);
console.log(`  Multi-currency Output: ${multiCurrencyPath}`);
console.log(`  Campaigns: ${fixtures.metadata.totalCampaigns}`);
console.log(`  Contributors: ${fixtures.metadata.totalContributors}`);
console.log(`  Contributions: ${fixtures.metadata.totalContributions}`);
console.log(`  Total Raised: ${(fixtures.metadata.totalRaised / 10_000_000).toFixed(2)} XLM`);

