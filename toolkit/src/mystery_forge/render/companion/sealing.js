// @ts-check
// Sealed content for the companion page: the JavaScript copy of toolkit/src/mystery_forge/sealing.py.
// contracts/sealing-vectors.json keeps both copies equal. It uses the SHA-256 of answers.js, so it also works from
// file://, where crypto.subtle is not always available.

(function registerSealing() {
  const answers = globalThis.MysteryForgeAnswers;
  const BLOCK_BYTES = 32;
  const CHECK_LENGTH = 16;

  /**
   * @param {string} hex
   * @returns {Uint8Array}
   */
  function hexBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  /**
   * @param {string} left
   * @param {string} right
   * @returns {string}
   */
  function xorHex(left, right) {
    const a = hexBytes(left);
    const b = hexBytes(right);
    return Array.from(a, (value, index) =>
      (value ^ /** @type {number} */ (b[index])).toString(16).padStart(2, '0'),
    ).join('');
  }

  /**
   * The key that one accepted answer gives for one lock, such as the lock of envelope B.
   * @param {string} salt
   * @param {string} label
   * @param {string} normalizedAnswer
   * @returns {string}
   */
  function answerKey(salt, label, normalizedAnswer) {
    return answers.sha256Hex(`${salt}:seal:${label}:${normalizedAnswer}`);
  }

  /**
   * @param {string} key
   * @returns {string}
   */
  function keyCheck(key) {
    return answers.sha256Hex(`${key}:check`).slice(0, CHECK_LENGTH);
  }

  /**
   * @param {string} sealed
   * @param {string} key
   * @returns {string}
   */
  function openText(sealed, key) {
    const binary = atob(sealed);
    const data = new Uint8Array(binary.length);
    /** @type {Uint8Array} */
    let block = new Uint8Array(0);
    for (let index = 0; index < binary.length; index += 1) {
      if (index % BLOCK_BYTES === 0) {
        block = hexBytes(answers.sha256Hex(`${key}:${index / BLOCK_BYTES}`));
      }
      data[index] = binary.charCodeAt(index) ^ /** @type {number} */ (block[index % BLOCK_BYTES]);
    }
    return new TextDecoder().decode(data);
  }

  /**
   * Return the content key of the lock that this normalized answer opens, or null when it opens nothing.
   * @param {MysteryForgeLock} lock
   * @param {string} salt
   * @param {string} normalizedAnswer
   * @returns {string | null}
   */
  function unlockKey(lock, salt, normalizedAnswer) {
    const own = answerKey(salt, lock.label, normalizedAnswer);
    for (const wrap of lock.wraps) {
      const key = xorHex(wrap, own);
      if (keyCheck(key) === lock.check) {
        return key;
      }
    }
    return null;
  }

  /**
   * Open a lock with the first of the answers that fits, or return null.
   * @param {MysteryForgeLock} lock
   * @param {string} salt
   * @param {string[]} normalizedAnswers
   * @returns {string | null}
   */
  function openLock(lock, salt, normalizedAnswers) {
    for (const answer of normalizedAnswers) {
      const key = unlockKey(lock, salt, answer);
      if (key !== null) {
        return openText(lock.payload, key);
      }
    }
    return null;
  }

  globalThis.MysteryForgeSealing = { answerKey, keyCheck, openText, unlockKey, openLock };
})();
