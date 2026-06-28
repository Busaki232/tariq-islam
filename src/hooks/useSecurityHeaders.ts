import { useEffect } from 'react';

/**
 * Hook to ensure security headers are properly set in the browser
 * This is a client-side verification of security policies
 */
export const useSecurityHeaders = () => {
  useEffect(() => {
    // Verify Content Security Policy is working
    const verifyCSP = () => {
      try {
        // Test for inline script execution (should be blocked)
        const script = document.createElement('script');
        script.innerHTML = 'window.__csp_test__ = true;';
        document.head.appendChild(script);
        document.head.removeChild(script);
        
        // If CSP is working, this should be undefined
        if ((window as any).__csp_test__) {
          console.warn('CSP may not be properly configured');
        }
      } catch (error) {
        // CSP is working if this throws
      }
    };

    // Verify frame busting is working
    const verifyFrameOptions = () => {
      if (window.self !== window.top) {
        console.warn('Application is running in a frame - potential clickjacking risk');
      }
    };

    // Run security checks
    verifyCSP();
    verifyFrameOptions();

    // Monitor for security-related changes
    const securityObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Check for potentially dangerous elements
              if (element.tagName === 'SCRIPT' && !element.hasAttribute('src')) {
                console.warn('Inline script detected - potential XSS risk');
              }
              
              if (element.tagName === 'IFRAME') {
                console.warn('Iframe added to DOM - verify source is trusted');
              }
            }
          });
        }
      });
    });

    // Observe document changes
    securityObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      securityObserver.disconnect();
    };
  }, []);
};