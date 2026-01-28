"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function WebsiteViewer() {
    const [url, setUrl] = useState("https://www.google.com");
    const [iframeContent, setIframeContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editModeVersion, setEditModeVersion] = useState(0);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [generatedCode, setGeneratedCode] = useState("");
    const iframeRef = useRef(null);

    // Helper: Detect if a string is a video URL
    const isVideoUrl = (link) => {
        if (!link) return false;
        return (
            link.includes("youtube.com") ||
            link.includes("youtu.be") ||
            link.includes("vimeo.com") ||
            link.match(/\.(mp4|webm|ogg)$/i)
        );
    };

    // Helper: Get Embed HTML for video
    const getVideoEmbed = (link) => {
        if (link.includes("youtube.com") || link.includes("youtu.be")) {
            let videoId = "";
            if (link.includes("v=")) videoId = link.split("v=")[1].split("&")[0];
            else if (link.includes("youtu.be/")) videoId = link.split("youtu.be/")[1];
            return `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        } else if (link.includes("vimeo.com")) {
            const videoId = link.split("vimeo.com/")[1];
            return `<iframe src="https://player.vimeo.com/video/${videoId}" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
        } else {
            // Direct video file
            return `<video width="100%" height="100%" controls><source src="${link}" type="video/mp4">Your browser does not support the video tag.</video>`;
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        let finalUrl = url;
        if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
            finalUrl = `https://${finalUrl}`;
        }

        setIsLoading(true);
        setIframeContent(""); // Clear to trigger reload visual
        setEditMode(false); // Reset edit mode on new load

        try {
            const response = await fetch(
                `/api/proxy?url=${encodeURIComponent(finalUrl)}`
            );
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                // Use warn instead of throw to avoid React error overlay, but set UI to error state
                console.warn(`Fetch warning for ${finalUrl}: ${response.status}`);
                setIframeContent(
                    `<div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;color:#ef4444;flex-direction:column;gap:10px;">
              <p style="font-size:18px;font-weight:bold;">Failed to load website.</p>
              <p>Please check the URL or try another one.</p>
            </div>`
                );
                return; // Stop execution
            }
            const html = await response.text();
            setIframeContent(html);
        } catch (error) {
            console.warn("Load Error (Silent):", error);
            setIframeContent(
                `<div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;color:#ef4444;flex-direction:column;gap:10px;">
          <p style="font-size:18px;font-weight:bold;">Failed to load website.</p>
          <p>Please check the URL or try another one.</p>
        </div>`
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Function to capture current code from iframe
    const captureCode = useCallback(() => {
        const iframe = iframeRef.current;
        if (!iframe) return "";
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (!doc) return "";
            const doctype = doc.doctype
                ? new XMLSerializer().serializeToString(doc.doctype)
                : "<!DOCTYPE html>";
            return `${doctype}\n${doc.documentElement.outerHTML}`;
        } catch (err) {
            console.error("Error capturing code:", err);
            return "";
        }
    }, []);

    const handleDownload = () => {
        const fullHtml = captureCode();
        if (!fullHtml) {
            alert("Could not capture code. Please try again.");
            return;
        }
        const blob = new Blob([fullHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "website-export.html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleViewCode = () => {
        const code = captureCode();
        if (code) {
            setGeneratedCode(code);
            setShowCodeModal(true);
        } else {
            alert("No content to view.");
        }
    };

    const handleCopyReact = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (!doc) {
                alert("No content to copy.");
                return;
            }

            // Get body content
            let htmlContent = doc.body.innerHTML;

            // Strategy Switch: Instead of fragile regex parsing, we will use dangerouslySetInnerHTML.
            // This is the only robust way to render arbitrary HTML "A to Z" inside React
            // without needing to regex-replace every single attribute (style strings, checked, selected, etc).
            // This also solves the "Invalid JSON" / Syntax errors because we are passing a string literal.

            // Escape backticks and standard JS string escapes for the generated code
            // htmlContent = htmlContent.replace(/`/g, "\\`").replace(/\$/g, "\\$");

            // Actually, best to JSON.stringify the string to ensure it's a valid string literal
            // But we want it readable in the template.

            // Let's use a simpler approach: pure string injection into dangerouslySetInnerHTML
            // We need to be careful about backticks if we use template literals in the output.

            const reactComponent = `import React from 'react';

export default function GeneratedComponent() {
  return (
    <div 
      dangerouslySetInnerHTML={{
        __html: \`
${htmlContent.replace(/`/g, "\\`").replace(/\${/g, "\\${")}
        \`
      }} 
    />
  );
}`;

            // Show code in modal instead of just copying (User Request: "react click panna react code irukanum")
            setGeneratedCode(reactComponent);
            setShowCodeModal(true);

            // Optional: Auto-copy as well
            // navigator.clipboard.writeText(reactComponent);
            // alert("React code copied to clipboard!");

        } catch (err) {
            console.error("Error generating React code:", err);
            alert("Failed to generate React code.");
        }
    };

    // Toggle Edit Logic
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const applyEditMode = () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (!doc) return;

                // Define the click handler using Event Delegation
                // This is more performant (one listener) and robust (catches dynamic elements and clicks inside links)
                const handleEditClick = (e) => {
                    const target = e.target;

                    // Check if clicked element is media or wrapped in media
                    // We also check closet to handle clicks on elements inside an anchor that wraps an image
                    const mediaElement = target.closest('img, video, iframe');
                    const linkElement = target.closest('a');

                    // If it's a media element, hijack the click for editing
                    if (mediaElement) {
                        e.preventDefault();
                        e.stopPropagation();

                        // Highlight briefly to show selection
                        const prevOutline = mediaElement.style.outline;
                        mediaElement.style.outline = "4px solid #f59e0b"; // Amber color to match edit theme

                        setTimeout(() => {
                            mediaElement.style.outline = prevOutline || "2px dashed #3b82f6";

                            const tagName = mediaElement.tagName.toLowerCase();
                            const isMedia = tagName !== 'img';
                            const currentSrc = mediaElement.src || mediaElement.getAttribute('src');

                            let promptMessage = isMedia
                                ? "Enter new Video/Iframe URL:"
                                : "Enter new Image URL, OR a Video URL (YouTube, Vimeo, MP4) to replace this image:";

                            const input = prompt(promptMessage, currentSrc);

                            if (input) {
                                if (isVideoUrl(input)) {
                                    // Replace media/img with new video container
                                    const container = doc.createElement("div");
                                    container.style.width = mediaElement.offsetWidth ? `${mediaElement.offsetWidth}px` : "100%";
                                    container.style.height = mediaElement.offsetHeight ? `${mediaElement.offsetHeight}px` : "auto";
                                    container.style.minHeight = "200px";
                                    container.innerHTML = getVideoEmbed(input);
                                    mediaElement.parentNode.replaceChild(container, mediaElement);
                                } else if (tagName === 'img') {
                                    mediaElement.src = input;
                                    mediaElement.removeAttribute("srcset");
                                } else if (tagName === 'iframe' || tagName === 'video') {
                                    mediaElement.src = input;
                                }
                            }
                            // Restore outline style implies we need to make sure we don't leave it Amber
                            if (editMode) mediaElement.style.outline = "2px dashed #3b82f6";
                        }, 50); // Short delay to allow visual feedback

                        return;
                    }

                    // If it's a link but NOT media, we want to prevent navigation but allow text editing (caret)
                    if (linkElement) {
                        // Prevent navigation
                        e.preventDefault();
                        // We allow bubbling so contenteditable handles the caret position
                    }
                };

                // Add or Remove styles and listeners
                if (editMode) {
                    doc.body.setAttribute("contenteditable", "true");

                    // Add styles to indicate editable elements
                    // specific styles for media to show they are interactive
                    const styleId = "editor-styles";
                    if (!doc.getElementById(styleId)) {
                        const style = doc.createElement("style");
                        style.id = styleId;
                        style.innerHTML = `
                            img:hover, video:hover, iframe:hover { outline: 4px solid #3b82f6 !important; cursor: pointer !important; transition: outline 0.1s; }
                            img, video, iframe { outline: 2px dashed #3b82f6; box-sizing: border-box; }
                            a { cursor: text !important; } 
                        `;
                        doc.head.appendChild(style);
                    }

                    // Attach Capture Phase listener to body to intercept everything
                    doc.body.addEventListener('click', handleEditClick, true);

                } else {
                    doc.body.removeAttribute("contenteditable");

                    // Remove listeners
                    doc.body.removeEventListener('click', handleEditClick, true);

                    // Remove styles
                    const style = doc.getElementById("editor-styles");
                    if (style) style.remove();

                    // Cleanup any inline styles we might have set via JS previously (though we used CSS mostly now)
                    // The CSS injection method is cleaner than iterating and setting inline styles.
                }
            } catch (err) {
                console.warn("Edit mode toggle warning:", err);
            }
        };

        // Apply immediately if content exists
        if (iframeContent) {
            applyEditMode();
        }
    }, [editMode, iframeContent, editModeVersion]);

    const handleIframeLoad = () => {
        // When iframe loads, if edit mode is active, we need to re-inject styles and listeners
        if (editMode && iframeRef.current) {
            // Re-trigger the effect logic basically.
            // We can do this by toggling a dummy state or just extracting the logic.
            // Since the logic is inside the effect, we can just let the user toggle off/on OR better,
            // we can't easily access the internal function of the effect.
            // Best approach: Toggle edit mode off and on? No that causes flicker.
            // Let's just update the timestamp or something to force effect re-run?
            // Actually, the previous `setTimeout` approach was okay but verbose. 
            // Let's use a cleaner approach: dispatch a custom event or just trust the user to toggle if needed?
            // User wants "lag free". 
            // Let's make `applyEditMode` accessible or just copy the logic?
            // Actually, we can just trigger a re-render or add a "key" to the effect dependency?
            // Adding `iframeRef.current` to dependency array doesn't work well.

            // Simplest Robust Fix: Just explicitly call the initialization again.
            // But we can't calls `applyEditMode` from here as it's scoped.
            // Let's move `applyEditMode` out or just duplicate the "enable" logic briefly.
            // OR, better: We can set a "version" state that increments on load.

            // For now, let's keep it simple: The effect uses `iframeContent`. 
            // When `iframeContent` changes, the effect runs! 
            // Wait, `iframeContent` IS the HTML. So when it changes, the effect runs and re-applies.
            // `onLoad` fires when that content is fully rendered.
            // The effect might run BEFORE the DOM is ready for listeners? 
            // Yes, `useEffect` runs after render, but for an iframe, `srcDoc` might take a moment to parse.
            // So `handleIframeLoad` IS valuable.

            // Let's just force the effect to run by updating a version.
            setEditModeVersion(v => v + 1);
        }
    };
    // Add editModeVersion to effect dependency


    return (
        <div className="w-full max-w-7xl mx-auto p-4 flex flex-col gap-6">
            {/* Main Interface */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ring-1 ring-slate-900/5">

                {/* Toolbar */}
                <div className="bg-slate-100 dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4">

                    {/* Navigation Controls */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex gap-1.5 mr-2">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <button
                            onClick={handleSubmit}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-600 dark:text-slate-300"
                            title="Refresh"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>

                    {/* URL Input */}
                    <form onSubmit={handleSubmit} className="flex-1 w-full relative group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 text-xs font-mono">https://</span>
                        </div>
                        <input
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg pl-16 pr-20 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                            value={url.replace(/^https?:\/\//, "")}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="example.com"
                        />
                        <button
                            type="submit"
                            className={`absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-all ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Loading...' : 'GO'}
                        </button>
                    </form>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            onClick={() => setEditMode(!editMode)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${editMode
                                ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            {editMode ? 'Stop Editing' : 'Edit'}
                        </button>
                        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                        <button
                            onClick={handleViewCode}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition-all border border-transparent"
                            title="View Source Code"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                            View
                        </button>
                        <button
                            onClick={handleCopyReact}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider bg-[#61DAFB] text-slate-900 hover:bg-[#4bc6e8] transition-all border border-transparent"
                            title="Copy as React Component"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 11.204c.48-1.554 1.486-2.923 2.768-3.765-.479-.304-1.045-.439-1.636-.339-1.284.218-2.31 1.258-2.502 2.544-.094.63.078 1.252.417 1.761-1.353-.872-2.365-2.28-2.61-3.953-.165-1.127.145-2.259.851-3.123 1.104-1.35 2.922-1.895 4.545-1.36.924.305 1.705.908 2.219 1.686 1.408 2.132-1.93 4.234-4.053 6.549zm1.096 2.053c-.302.268-.691.383-1.096.383-1.049 0-1.875-.765-1.875-1.748 0-.324.095-.629.259-.894 1.17 1.579 2.096 1.954 2.712 2.259zm4.279-4.789c.394.686.533 1.493.385 2.296-.289 1.564-1.583 2.775-3.13 2.946-1.583.175-3.053-.615-3.804-1.896-.707-1.206-.632-2.738.169-3.885.506-.725 1.246-1.18 2.073-1.277 1.62-.191 3.129.845 3.823 2.337.209.447.348.922.484 1.479zm-4.722 8.529c-1.379.74-2.128 2.264-1.84 3.766.191.996.864 1.815 1.766 2.186 1.346.554 2.909.07 3.824-1.077.587-.736.812-1.68.618-2.597-.132-.625-.436-1.179-.854-1.619-1.208 1.428-2.372.585-3.514-.659zm5.325-1.488c.844.757 1.391 1.782 1.491 2.915.111 1.25-.332 2.455-1.196 3.296-1.299 1.265-3.321 1.458-4.871.496-1.018-.631-1.691-1.688-1.83-2.868-.088-.737.078-1.465.419-2.074 1.201.767 2.378-.458 3.551-1.666.97.234 1.766.526 2.436.901z" /></svg>
                            React
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20"
                            title="Download HTML"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export
                        </button>
                    </div>
                </div>

                {/* Browser Content */}
                <div className="relative h-[700px] w-full bg-white dark:bg-gray-100">
                    {iframeContent ? (
                        <iframe
                            ref={iframeRef}
                            srcDoc={iframeContent}
                            className="w-full h-full border-0 block"
                            title="Site Preview"
                            onLoad={handleIframeLoad}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900/50">
                            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                            <p className="text-lg font-medium">Ready to browse</p>
                            <p className="text-sm opacity-75">Enter a URL above to start</p>
                        </div>
                    )}

                    {/* Edit Mode Indicator (Floating) */}
                    {editMode && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-500/90 text-white text-sm font-medium rounded-full shadow-lg backdrop-blur-sm pointer-events-none flex items-center gap-2 z-10">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                            </span>
                            Editing Active: Click text to edit, click images to replace/add video.
                        </div>
                    )}
                </div>
            </div>

            {/* Code Viewer Modal */}
            {showCodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col ring-1 ring-white/10">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                Source Code
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(generatedCode);
                                        alert("Code copied to clipboard!");
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                                >
                                    Copy All
                                </button>
                                <button
                                    onClick={() => setShowCodeModal(false)}
                                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 hover:text-red-500 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-[#0d1117]">
                            <pre className="text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                                {generatedCode}
                            </pre>
                        </div>
                        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/50 text-right">
                            <span className="text-xs text-slate-500">
                                {generatedCode.length} chars
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
