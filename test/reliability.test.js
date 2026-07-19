import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateFinancialImpact, shouldAlert, buildAlertPayload } from '../src/reliability.js';

const footprint = {
  businessService: 'Checkout API',
  computeInstances: 100,
  storageTb: 50,
  databaseInstances: 10,
  highTrafficRegions: ['us-east-1'],
  dependencies: ['EC2'],
  regions: { 'us-east-1': 0.5 },
};
const incident = { service: 'EC2', region: 'us-east-1', severity: 'major', estimatedMinutes: 60, status: 'degraded' };

test('estimates financial exposure for a regional incident', () => {
  assert.equal(estimateFinancialImpact(footprint, incident).total > 0, true);
});

test('only alerts for major incidents matching dependencies and high traffic regions', () => {
  assert.equal(shouldAlert(incident, footprint), true);
  assert.equal(shouldAlert({ ...incident, region: 'eu-west-1' }, footprint), false);
});

test('builds Slack/email-ready payload with RCA link', () => {
  const payload = buildAlertPayload({ ...incident, rcaUrl: 'https://example.com/rca' }, { name: 'AWS', statusUrl: 'https://status', rcaUrl: 'https://fallback' }, { total: 1234 }, footprint);
  assert.match(payload.text, /AWS EC2 disruption/);
  assert.match(JSON.stringify(payload), /https:\/\/example.com\/rca/);
});
