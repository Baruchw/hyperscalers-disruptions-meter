export const PROVIDERS = [
  {
    id: 'aws',
    name: 'AWS',
    statusUrl: 'https://health.aws.amazon.com/health/status',
    rcaUrl: 'https://aws.amazon.com/premiumsupport/technology/pes/',
    services: ['EC2', 'S3', 'RDS', 'Lambda', 'CloudFront'],
  },
  {
    id: 'azure',
    name: 'Azure',
    statusUrl: 'https://status.azure.com/status',
    rcaUrl: 'https://azure.status.microsoft/en-us/status/history/',
    services: ['Virtual Machines', 'Blob Storage', 'Azure SQL', 'Functions', 'Front Door'],
  },
  {
    id: 'gcp',
    name: 'Google Cloud',
    statusUrl: 'https://status.cloud.google.com/',
    rcaUrl: 'https://status.cloud.google.com/incidents',
    services: ['Compute Engine', 'Cloud Storage', 'Cloud SQL', 'Cloud Run', 'Cloud CDN'],
  },
];

export const COST_DEFAULTS = {
  computeHourly: 0.096,
  storageMonthlyPerTb: 23,
  databaseHourly: 0.29,
  revenuePerHour: 12000,
  trafficAtRiskPercent: 35,
};

export function estimateFinancialImpact(footprint, incident, rates = COST_DEFAULTS) {
  const hours = Math.max(incident.estimatedMinutes, 1) / 60;
  const regionWeight = footprint.regions?.[incident.region] ?? 0.25;
  const dependencyWeight = footprint.dependencies?.includes(incident.service) ? 1 : 0.35;
  const compute = footprint.computeInstances * rates.computeHourly * hours * regionWeight;
  const storage = footprint.storageTb * (rates.storageMonthlyPerTb / (30 * 24)) * hours * regionWeight;
  const database = footprint.databaseInstances * rates.databaseHourly * hours * regionWeight;
  const revenue = rates.revenuePerHour * (rates.trafficAtRiskPercent / 100) * hours * regionWeight * dependencyWeight;
  return {
    infrastructure: roundCurrency(compute + storage + database),
    revenueAtRisk: roundCurrency(revenue),
    total: roundCurrency(compute + storage + database + revenue),
  };
}

export function shouldAlert(incident, footprint) {
  return incident.severity === 'major' &&
    footprint.highTrafficRegions.includes(incident.region) &&
    footprint.dependencies.includes(incident.service);
}

export function buildAlertPayload(incident, provider, impact, footprint) {
  return {
    text: `${provider.name} ${incident.service} disruption in ${incident.region}: estimated $${impact.total.toLocaleString()} at risk`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `${provider.name} reliability alert` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${incident.service}* is reporting *${incident.status}* in *${incident.region}* for ${footprint.businessService}.` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Severity:*\n${incident.severity}` },
        { type: 'mrkdwn', text: `*Financial exposure:*\n$${impact.total.toLocaleString()}` },
        { type: 'mrkdwn', text: `*Status page:*\n${provider.statusUrl}` },
        { type: 'mrkdwn', text: `*RCA:*\n${incident.rcaUrl || provider.rcaUrl}` },
      ] },
    ],
  };
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}
