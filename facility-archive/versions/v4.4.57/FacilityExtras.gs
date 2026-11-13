function includeFacilityExtras_() {
  return HtmlService.createHtmlOutputFromFile('FacilityExtrasUI').getContent();
}

function getFacilityAccessQrUrl() {
  const url = ScriptApp.getService().getUrl();
  const match = String(url || '').match(/^https:\/\/script\.google\.com\/(?:macros\/s|a\/macros\/[A-Za-z0-9.-]+\/s)\/[A-Za-z0-9_-]+\/exec(?=$|[?#])/);
  return match ? match[0] : '';
}
