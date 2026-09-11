// Modos de revisão são opt-in por URL e nunca alteram a experiência publicada por acidente.
// `typeof location` mantém este módulo importável pelos testes Node.
const params=typeof location==='undefined'?null:new URLSearchParams(location.search);
export const FARM_PROTOTYPE_MODE=params?.get('farmtest')==='1';
