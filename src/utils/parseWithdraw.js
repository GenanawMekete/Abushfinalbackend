/**
 * Parse withdrawal request messages
 */
function parseWithdraw(message) {
  const text = message.trim().toLowerCase();
  
  // Check if message contains a valid amount
  const amountRegex = /(\d+(?:\.\d{2})?)\s*(?:etb|birr|ብር)?/i;
  const amountMatch = text.match(amountRegex);
  
  if (!amountMatch) {
    return null;
  }
  
  const amount = parseFloat(amountMatch[1]);
  
  // Check if message contains phone number
  const phoneRegex = /(09\d{8}|9\d{8})/;
  const phoneMatch = text.match(phoneRegex);
  
  return {
    amount,
    phoneNumber: phoneMatch ? phoneMatch[1] : null,
    isValid: amount > 0
  };
}

module.exports = parseWithdraw;
