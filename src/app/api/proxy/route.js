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

        // Helper to Convert relative URLs to absolute
        const makeAbsolute = (link) => {
            try {
                return new URL(link, url).href;
            } catch (e) {
                return link;
            }
        };

        // Rewrite standard attributes
        $('img, script, iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src) $(el).attr('src', makeAbsolute(src));
        });

        $('link, a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) $(el).attr('href', makeAbsolute(href));
        });

        // Simplistic srcset rewriting
        $('img').each((i, el) => {
            const srcset = $(el).attr('srcset');
            if (srcset) {
                const newSrcset = srcset.split(',').map(part => {
                    const [src, desc] = part.trim().split(/\s+/);
                    if (src) return `${makeAbsolute(src)} ${desc || ''}`;
                    return part;
                }).join(', ');
                $(el).attr('srcset', newSrcset);
            }
        })

        // Inject anti-frame-busting script and base tag
        // We try to prevent the site from breaking out of the iframe
        $('head').prepend(`
        <base href="${url}" />
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
        return NextResponse.json({ error: 'Failed to process request', details: error.message }, { status: 500 });
    }
}