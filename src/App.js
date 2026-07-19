import { PROVIDERS, COST_DEFAULTS, buildAlertPayload, estimateFinancialImpact, shouldAlert } from './reliability.js';

const footprint = {
  businessService: 'Checkout API', computeInstances: 420, storageTb: 180, databaseInstances: 44,
  highTrafficRegions: ['us-east-1', 'eastus', 'us-central1'],
  dependencies: ['EC2', 'RDS', 'Virtual Machines', 'Azure SQL', 'Compute Engine', 'Cloud SQL'],
  regions: { 'us-east-1': 0.42, eastus: 0.31, 'us-central1': 0.27, global: 1 },
};
const incidents = [
  { providerId: 'aws', service: 'EC2', region: 'us-east-1', status: 'Increased launch failures and network packet loss', severity: 'major', estimatedMinutes: 95, updatedAt: 'live poll: 42s ago', rcaUrl: '' },
  { providerId: 'azure', service: 'Blob Storage', region: 'westeurope', status: 'Intermittent availability degradation', severity: 'minor', estimatedMinutes: 35, updatedAt: 'live poll: 1m ago', rcaUrl: 'https://azure.status.microsoft/en-us/status/history/' },
  { providerId: 'gcp', service: 'Cloud SQL', region: 'us-central1', status: 'Elevated connection errors', severity: 'major', estimatedMinutes: 54, updatedAt: 'live poll: 18s ago', rcaUrl: 'https://status.cloud.google.com/incidents' },
];
let state = { ...footprint, webhook: '', alertLog: [] };

function render() {
  const enriched = incidents.map((incident) => {
    const provider = PROVIDERS.find((item) => item.id === incident.providerId);
    const impact = estimateFinancialImpact(state, incident, COST_DEFAULTS);
    return { ...incident, provider, impact, alert: shouldAlert(incident, state) };
  });
  document.querySelector('#app').innerHTML = `
    <section class="hero"><div><p class="eyebrow">◉ real-time hyperscaler watch</p><h1>Global cloud reliability command center</h1><p>Monitor AWS, Azure, and Google Cloud public status surfaces, map incidents to high-traffic dependencies, estimate financial exposure, and trigger Slack or email alerts with RCA links as they become available.</p></div><div class="pulse"><span>☁</span><strong>${enriched.filter((i) => i.alert).length}</strong><em>critical matches</em></div></section>
    <section class="grid providers">${PROVIDERS.map((p) => `<article class="card"><h2>${p.name}</h2><p>${p.services.join(' • ')}</p><a href="${p.statusUrl}">Status page</a><a href="${p.rcaUrl}">RCA history</a></article>`).join('')}</section>
    <section class="panel"><h2>💵 Infrastructure footprint calculator</h2><div class="form-grid">${numberInput('computeInstances', 'Compute instances')}${numberInput('storageTb', 'Storage TB')}${numberInput('databaseInstances', 'DB instances')}<label>Slack webhook<input id="webhook" placeholder="https://hooks.slack.com/services/..." value="${state.webhook}"></label></div></section>
    <section class="panel"><h2>⚠️ Active disruptions</h2>${enriched.map(incidentCard).join('')}</section>
    <section class="panel"><h2>🔁 Alert log</h2>${state.alertLog.length ? state.alertLog.map((log) => `<p><a href="${log.mailto}">Email fallback</a> · ${log.message}</p>`).join('') : '<p>No alerts sent this session.</p>'}</section>`;
  document.querySelectorAll('[data-number]').forEach((input) => input.addEventListener('input', (event) => { state[event.target.id] = Number(event.target.value); render(); }));
  document.querySelector('#webhook').addEventListener('input', (event) => { state.webhook = event.target.value; });
  document.querySelectorAll('[data-alert]').forEach((button) => button.addEventListener('click', () => sendAlert(enriched[Number(button.dataset.alert)])));
}
function numberInput(id, label) { return `<label>${label}<input data-number id="${id}" type="number" value="${state[id]}"></label>`; }
function incidentCard(incident, index) { return `<article class="incident ${incident.alert ? 'hot' : ''}"><div><strong>${incident.provider.name} · ${incident.service}</strong><p>${incident.status}</p><small>${incident.region} · ${incident.updatedAt} · RCA: <a href="${incident.rcaUrl || incident.provider.rcaUrl}">available when published</a></small></div><div class="impact"><span>$${incident.impact.total.toLocaleString()}</span><small>$${incident.impact.infrastructure.toLocaleString()} infra + $${incident.impact.revenueAtRisk.toLocaleString()} revenue</small></div><button data-alert="${index}" ${incident.alert ? '' : 'disabled'}>🔔 Alert</button></article>`; }
async function sendAlert(incident) { const payload = buildAlertPayload(incident, incident.provider, incident.impact, state); if (state.webhook) await fetch(state.webhook, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }); const mailto = `mailto:sre@example.com?subject=${encodeURIComponent(payload.text)}&body=${encodeURIComponent(JSON.stringify(payload, null, 2))}`; state.alertLog = [{ at: new Date().toISOString(), message: payload.text, mailto }, ...state.alertLog]; render(); }
render();
