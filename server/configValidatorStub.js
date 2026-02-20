/**
 * JLH Config Validator — STUB
 *
 * Drop-in replacement for configValidator.js that always returns valid.
 * Use this when testing other parts of JLH without needing a real config file.
 *
 * Usage: replace require('./configValidator') with require('./configValidatorStub')
 */

async function validate() {
  return { valid: true, messages: [] };
}

module.exports = { validate };
