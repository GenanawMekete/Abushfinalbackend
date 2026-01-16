/**
 * Parse Telebirr SMS to extract transaction details
 * Example SMS: "You have received 100.00 ETB from 0912xxxxxx. Your new balance is 500.00 ETB. Transaction ID: ABC123XYZ"
 */
function parseTelebirr(smsText) {
  if (!smsText || typeof smsText !== 'string') {
    return null;
  }
  
  // Normalize text
  const text = smsText.trim().replace(/\s+/g, ' ');
  
  // Common patterns in Telebirr SMS
  const patterns = [
    // Pattern 1: Received amount
    /(?:received|credited)\s+(\d+(?:\.\d{2})?)\s+ETB/i,
    
    // Pattern 2: Transfer amount
    /(\d+(?:\.\d{2})?)\s+ETB\s+(?:sent|transferred|paid)/i,
    
    // Pattern 3: Transaction ID
    /(?:transaction\s+id|txn\s+id|ref\s+no)[:\s]+([A-Z0-9]+)/i,
    
    // Pattern 4: Phone number
    /(?:from|to)\s+(09\d{8}|9\d{8})/i
  ];
  
  let amount = null;
  let transactionId = null;
  let phoneNumber = null;
  
  // Extract amount
  const amountMatch = text.match(patterns[0]) || text.match(patterns[1]);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
  }
  
  // Extract transaction ID
  const txnMatch = text.match(patterns[2]);
  if (txnMatch) {
    transactionId = txnMatch[1];
  }
  
  // Extract phone number
  const phoneMatch = text.match(patterns[3]);
  if (phoneMatch) {
    phoneNumber = phoneMatch[1];
  }
  
  // Additional validation for common Ethiopian SMS formats
  if (!amount) {
    // Try alternative patterns
    const altPattern = /(\d+(?:\.\d{2})?)\s+Birr/i;
    const altMatch = text.match(altPattern);
    if (altMatch) {
      amount = parseFloat(altMatch[1]);
    }
  }
  
  if (!transactionId) {
    // Look for any uppercase alphanumeric string that might be a transaction ID
    const possibleTxn = text.match(/\b([A-Z0-9]{8,20})\b/);
    if (possibleTxn && possibleTxn[1].length >= 8) {
      transactionId = possibleTxn[1];
    }
  }
  
  // Return null if essential info is missing
  if (!amount || !transactionId) {
    return null;
  }
  
  return {
    amount,
    transactionId,
    phoneNumber,
    rawText: text
  };
}

module.exports = parseTelebirr;
