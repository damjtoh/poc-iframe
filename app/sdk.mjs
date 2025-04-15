// --- SDK Script (sdk.js) ---
console.log("[SDK] Script loaded.");

// Use an IIFE (Immediately Invoked Function Expression) to create a private scope
const mySDK = (() => {
  // --- Configuration ---
  const LAUNCHER_ORIGIN = "http://localhost:3000"; // Where the iframe handler lives
  const IFRAME_HANDLER_URL = `${LAUNCHER_ORIGIN}/launcher-iframe-handler.html`;

  let authToken = null;
  let launcherIframe = null;
  let iframeReady = false;
  let isAuthenticated = false;
  let messageQueue = []; // Queue messages if iframe isn't ready yet

  function log(message) {
    console.log("[SDK]", message);
    // Forward log to app's logger if available
    if (typeof window.log === "function") {
      // window.log(`[SDK] ${message}`); // Avoid double logging to console
    }
  }

  // --- Initialization ---
  function init() {
    log("Initializing...");
    const urlParams = new URLSearchParams(window.location.search);
    authToken = urlParams.get("sdkAuthToken");

    if (!authToken) {
      log("Auth token missing in URL. Enhanced APIs disabled.");
      if (typeof window.handleSdkStatusUpdate === "function") {
        window.handleSdkStatusUpdate(
          "Initialization Failed",
          "Auth token missing"
        );
      }
      return; // Stop initialization
    }

    log(`Retrieved auth token: ${authToken}`);
    if (typeof window.handleSdkStatusUpdate === "function") {
      window.handleSdkStatusUpdate(
        "Initializing",
        "Token found, creating iframe..."
      );
    }
    createLauncherIframe();
    setupMessageListener();
  }

  // --- Iframe Management ---
  function createLauncherIframe() {
    log(`Creating iframe with src: ${IFRAME_HANDLER_URL}`);
    launcherIframe = document.createElement("iframe");
    launcherIframe.src = IFRAME_HANDLER_URL;
    launcherIframe.style.display = "none"; // Keep it hidden
    launcherIframe.setAttribute("aria-hidden", "true");
    launcherIframe.setAttribute("title", "SDK Communication Channel");

    launcherIframe.onload = () => {
      log("Launcher iframe loaded.");
      iframeReady = true;
      // Send initial authentication message
      sendMessageToLauncher({ type: "authenticate", token: authToken });
      if (typeof window.handleSdkStatusUpdate === "function") {
        window.handleSdkStatusUpdate(
          "Authenticating",
          "Sent token to launcher iframe."
        );
      }
      // Process any queued messages
      processMessageQueue();
    };

    launcherIframe.onerror = (error) => {
      log(`Error loading launcher iframe: ${error}`);
      if (typeof window.handleSdkStatusUpdate === "function") {
        window.handleSdkStatusUpdate(
          "Initialization Failed",
          "Error loading iframe"
        );
      }
    };

    document.body.appendChild(launcherIframe);
  }

  // --- Communication ---
  function sendMessageToLauncher(message) {
    if (!launcherIframe || !launcherIframe.contentWindow) {
      log("Error: Launcher iframe not available.");
      return;
    }

    if (!iframeReady) {
      log("Iframe not ready, queueing message: " + message.type);
      messageQueue.push(message);
      return;
    }

    log(
      `Sending message to launcher iframe (${LAUNCHER_ORIGIN}): Type='${message.type}'`
    );
    // SECURITY: ALWAYS specify the target origin
    launcherIframe.contentWindow.postMessage(message, LAUNCHER_ORIGIN);
  }

  function processMessageQueue() {
    log(`Processing ${messageQueue.length} queued messages.`);
    while (messageQueue.length > 0) {
      const message = messageQueue.shift();
      sendMessageToLauncher(message); // Will now send since iframeReady is true
    }
  }

  function setupMessageListener() {
    window.addEventListener("message", (event) => {
      // SECURITY: ALWAYS verify the origin of the message!
      if (event.origin !== LAUNCHER_ORIGIN) {
        log(`Ignoring message from unexpected origin: ${event.origin}`);
        return;
      }

      // *** CORRECTED LINE ***
      log(
        `Received message from launcher iframe: Type='${
          event.data && event.data.type
        }'`
      );

      if (!event.data || typeof event.data !== "object") {
        log("Ignoring invalid message format from launcher.");
        return;
      }
      switch (event.data.type) {
        case "auth_success":
          isAuthenticated = true;
          log("Authentication successful!");
          if (typeof window.handleSdkStatusUpdate === "function") {
            window.handleSdkStatusUpdate(
              "Authenticated",
              "Ready to call APIs."
            );
          }
          break;
        case "auth_failure":
          isAuthenticated = false;
          const reason = event.data.reason || "Unknown reason";
          log(`Authentication failed: ${reason}`);
          if (typeof window.handleSdkStatusUpdate === "function") {
            window.handleSdkStatusUpdate("Authentication Failed", reason);
          }
          // Consider cleanup/disabling API calls
          break;
        case "api_result":
          log(`Received API result for action '${event.data.originalAction}'.`);
          if (typeof window.handleSdkApiResponse === "function") {
            window.handleSdkApiResponse(event.data);
          }
          break;
        default:
          log(
            `Ignoring unknown message type from launcher: ${event.data.type}`
          );
      }
    });
  }

  // --- Public SDK API ---
  function callFirmware(action, payload) {
    if (!isAuthenticated) {
      log("Cannot call firmware API: SDK not authenticated.");
      alert("SDK Error: Not authenticated.");
      return;
    }
    if (!action) {
      log("API call failed: Action is required.");
      return;
    }

    log(`Exposing API call: Action='${action}'`);
    sendMessageToLauncher({
      type: "api_call",
      action: action,
      payload: payload || {}, // Ensure payload is at least an empty object
    });
  }

  // --- Start Initialization ---
  // Wait for the DOM to be ready before potentially adding the iframe
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // --- Expose Public Methods ---
  return {
    callFirmware: callFirmware,
    // Add other SDK methods here
  };
})(); // Immediately invoke the function to initialize the SDK and return the public API

// Optional: Make it available globally for the app to use easily
window.mySDK = mySDK;
