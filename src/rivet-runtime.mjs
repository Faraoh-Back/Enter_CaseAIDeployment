import * as Rivet from '@ironclad/rivet-node';
import initialize from '../rivet/plugins/enter-bounded-extraction/index.js';
// Mesmo plugin utilizado pelo aplicativo; sem alterar node_modules.
if (!Rivet.globalRivetNodeRegistry.isRegistered('enterBoundedExtraction')) {
  Rivet.globalRivetNodeRegistry.registerPlugin(initialize(Rivet));
}
export * from '@ironclad/rivet-node';
