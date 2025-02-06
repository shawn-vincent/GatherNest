export function log(emoji, message, ...data) {
  const timestamp = new Date().toISOString();
  if (data.length > 0) {
    console.log("[" + timestamp + "] " + emoji + " " + message, ...data);
  } else {
    console.log("[" + timestamp + "] " + emoji + " " + message);
  }
}

export function logError(emoji, message, ...data) {
  const timestamp = new Date().toISOString();
  if (data.length > 0) {
    console.error("[" + timestamp + "] " + emoji + " " + message, ...data);
  } else {
    console.error("[" + timestamp + "] " + emoji + " " + message);
  }
}
