import { useEffect } from "react";

type SEOProps = {
  title: string;
  description: string;
  canonical?: string;
  jsonLd?: object;
};

export const SEO = ({ title, description, canonical, jsonLd }: SEOProps) => {
  useEffect(() => {
    if (title) document.title = title;

    const ensureTag = (selector: string, create: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      if (!el) { el = create(); document.head.appendChild(el); }
      return el;
    };

    // Meta description
    const desc = ensureTag('meta[name="description"]', () => {
      const m = document.createElement('meta'); m.setAttribute('name','description'); return m;
    });
    desc.setAttribute('content', description);

    // Canonical
    if (canonical) {
      const link = ensureTag('link[rel="canonical"]', () => {
        const l = document.createElement('link'); l.setAttribute('rel','canonical'); return l;
      });
      link.setAttribute('href', canonical);
    }

    // JSON-LD structured data
    const existing = document.getElementById('AgroElevate-jsonld');
    if (existing) existing.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'AgroElevate-jsonld';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, canonical, jsonLd]);

  return null;
};
