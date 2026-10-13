import * as Rivet from '@ironclad/rivet-node';
import initialize from '../rivet/plugins/enter-bounded-extraction/index.js';

let request = (...args) => globalThis.fetch(...args);
let active = false;
// Transporte exclusivo do plugin; HTTP da aplicação e de clientes não é interceptado.
if (!Rivet.globalRivetNodeRegistry.isRegistered('enterBoundedExtraction')) {
  Rivet.globalRivetNodeRegistry.registerPlugin(initialize(Rivet, {fetch:(...args)=>request(...args)}));
}
export function reservarExecucaoRivet() {
  if (active) throw new Error('EXECUCAO_ATIVA');
  active = true;
  return () => { active = false; };
}
export function instalarTransporteRivet(fetch) {
  const previous = request;
  request = fetch;
  return () => { request = previous; };
}
export * from '@ironclad/rivet-node';
