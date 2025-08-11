import { Helmet } from "react-helmet-async";

type SEOProps = {
  title: string;
  description: string;
  canonical?: string;
  jsonLd?: object;
};

export const SEO = ({ title, description, canonical, jsonLd }: SEOProps) => {
  const url = canonical || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined);
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};
