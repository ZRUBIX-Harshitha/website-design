"use client";


import React from "react";
import WebsiteViewer from "./components/WebsiteViewer";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">

      <div className="text-center mb-10 space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 tracking-tight">
          Website Preview Tool
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Visualize any website instantly. Enter a URL below to see a live preview in a professional browser frame.
        </p>
      </div>

      <WebsiteViewer />

      <footer className="mt-16 text-sm text-gray-500 dark:text-gray-400">
        <p>&copy; {new Date().getFullYear()} Website Preview Tool. Designed for Professionals.</p>
      </footer>




    </main>


  );
}
