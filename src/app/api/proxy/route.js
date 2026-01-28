import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch URL: ${response.statusText}` }, { status: response.status });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // API Context: Use the final URL from the response to handle redirects correctly.
        // This is critical for relative assets to load from the correct path.
        const finalUrl = response.url || url;

        // Inject anti-frame-busting script and base tag
        // We use the base tag to resolve all relative URLs automatically, ensuring high fidelity.
        $('head').prepend(`
        <base href="${finalUrl}" />
        <script>
            // Anti-frame-busting
            try {
                if (window.top !== window.self) {
                    window.top = window.self;
                }
            } catch (e) { }
        </script>
    `);

        return new NextResponse($.html(), {
            headers: {
                'Content-Type': 'text/html',
            },
        });
    } catch (error) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: 'Failed to process request', details: error.message }, { status: 500 });
    }
}
