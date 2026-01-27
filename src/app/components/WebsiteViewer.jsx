"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function WebsiteViewer() {
    const [url, setUrl] = useState("https://www.google.com");
    const [iframeContent, setIframeContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
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
            if (!response.ok) throw new Error("Failed to fetch");
            const html = await response.text();
            setIframeContent(html);
        } catch (error) {
            console.error("Load Error:", error);
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

    // Toggle Edit Logic
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const applyEditMode = () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (!doc) return;

                if (editMode) {
                    doc.body.setAttribute("contenteditable", "true");
                    // Add handlers to all elements that might need specific editing
                    const images = doc.getElementsByTagName("img");
                    for (let img of images) {
                        img.style.cursor = "pointer";
                        img.style.border = "2px dashed #3b82f6";
                        img.style.boxSizing = "border-box";
                        img.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const input = prompt(
                                "Enter new Image URL, OR a Video URL (YouTube, Vimeo, MP4) to replace this image:",
                                img.src
                            );
                            if (input) {
                                if (isVideoUrl(input)) {
                                    // Replace img with video container
                                    const container = doc.createElement("div");
                                    container.style.width = img.width ? `${img.width}px` : "100%";
                                    container.style.height = img.height
                                        ? `${img.height}px`
                                        : "auto";
                                    container.style.minHeight = "200px";
                                    container.innerHTML = getVideoEmbed(input);
                                    img.parentNode.replaceChild(container, img);
                                } else {
                                    // Just update image
                                    img.src = input;
                                    img.removeAttribute("srcset");
                                }
                            }
                        };
                    }
                } else {
                    doc.body.removeAttribute("contenteditable");
                    const images = doc.getElementsByTagName("img");
                    for (let img of images) {
                        img.style.cursor = "";
                        img.style.border = "";
                        img.onclick = null;
                    }
                }
            } catch (err) {
                // Silent catch for cross-origin potential issues, though srcDoc mitigates most
                console.warn("Edit mode toggle warning:", err);
            }
        };

        // Apply immediately if content exists
        if (iframeContent) {
            applyEditMode();
        }
    }, [editMode, iframeContent]);

    const handleIframeLoad = () => {
        // Re-apply edit mode settings when iframe finishes loading (if still in edit mode)
        if (editMode && iframeRef.current) {
            // We trigger a re-run of the effect by touching a dummy state or just calling logic? 
            // Best is to let the effect run, but for cleanliness:
            // The effect depends on 'editMode' and 'iframeContent'. 
            // 'iframeContent' doesn't change on load, but the DOM does.
            // So we manually re-invoke the clean/dirty logic if needed.
            // Actually, the effect runs on mount/update. 
            // We can just manually call the logic here to be safe.
            // For now, let's trust the user toggles or the effect runs. 
            // Use setTimeout to allow DOM to settle.
            setTimeout(() => {
                // Logic repeated from effect for safety on reload
                // (Simplified version)
                try {
                    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
                    if (doc) {
                        doc.body.setAttribute("contenteditable", "true");
                        const images = doc.getElementsByTagName("img");
                        for (let img of images) {
                            img.style.cursor = "pointer";
                            img.style.border = "2px dashed #3b82f6";
                            img.onclick = (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const input = prompt("Update Image/Video URL:", img.src);
                                if (input) {
                                    if (isVideoUrl(input)) {
                                        const d = doc.createElement('div');
                                        d.innerHTML = getVideoEmbed(input);
                                        img.parentNode.replaceChild(d, img);
                                    } else {
                                        img.src = input;
                                        img.removeAttribute("srcset");
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { }
            }, 500);
        }
    };

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
