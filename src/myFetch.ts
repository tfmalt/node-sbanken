const __fetch = typeof fetch === 'undefined' ? require('node-fetch') : fetch;
export default __fetch;
