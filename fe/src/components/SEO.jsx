import { Helmet } from 'react-helmet-async'
import defaultOgImage from '@/assets/Payhook.png'

const DEFAULT_TITLE = 'Payhook - Nhận thông báo giao dịch ngay lập tức'
const DEFAULT_DESCRIPTION =
  'Payhook giúp nhận thông báo giao dịch ngân hàng CAKE ngay lập tức qua Gmail Push Notifications, webhook và dashboard realtime.'
const DEFAULT_KEYWORDS = [
  'Payhook',
  'Gmail Push Notifications',
  'webhook CAKE',
  'thanh toán realtime',
  'tự động hóa giao dịch',
]
const DEFAULT_SITE_URL = import.meta.env.VITE_SITE_URL || 'https://www.payhook.codes'
const DEFAULT_TWITTER = '@payhook'

const buildAbsoluteUrl = (pathOrUrl) => {
  if (!pathOrUrl) return undefined
  try {
    return new URL(pathOrUrl, DEFAULT_SITE_URL).toString()
  } catch (error) {
    return undefined
  }
}

const toAbsoluteImage = (image) => {
  if (!image) return buildAbsoluteUrl(defaultOgImage)
  if (image.startsWith('http://') || image.startsWith('https://')) return image
  return buildAbsoluteUrl(image)
}

const DEFAULT_ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Payhook',
  url: DEFAULT_SITE_URL,
  logo: buildAbsoluteUrl('/android-chrome-512x512.png'),
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'phanvothanhtai1007@gmail.com',
  },
}

export function PageSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  pathname = '/',
  image,
  robots = 'index,follow',
  type = 'website',
  structuredData,
}) {
  // Nếu không có title hoặc title đã là DEFAULT_TITLE, dùng DEFAULT_TITLE
  // Nếu title chỉ là "Payhook", giữ nguyên
  // Nếu có title khác, format thành "Payhook - {title}" (tránh duplicate "Payhook -")
  const pageTitle = !title || title === DEFAULT_TITLE
    ? DEFAULT_TITLE
    : title === 'Payhook'
    ? 'Payhook'
    : title.startsWith('Payhook -')
    ? title
    : `Payhook - ${title}`
  const canonicalUrl = buildAbsoluteUrl(pathname)
  const ogImage = toAbsoluteImage(image)
  const structuredDataArray = [
    DEFAULT_ORGANIZATION_SCHEMA,
    ...(structuredData
      ? Array.isArray(structuredData)
        ? structuredData
        : [structuredData]
      : []),
  ]

  return (
    <Helmet prioritizeSeoTags>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={Array.isArray(keywords) ? keywords.join(', ') : keywords} />
      <meta name="robots" content={robots} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:site_name" content="Payhook" />
      <meta property="og:type" content={type} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:creator" content={DEFAULT_TWITTER} />
      <meta name="twitter:site" content={DEFAULT_TWITTER} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {/* PWA */}
      <meta name="application-name" content="Payhook" />
      <meta name="apple-mobile-web-app-title" content="Payhook" />

      {/* Structured Data */}
      {structuredDataArray.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema, null, 2)}
        </script>
      ))}
    </Helmet>
  )
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Payhook',
    alternateName: 'Payhook Webhook CAKE',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: DEFAULT_DESCRIPTION,
    url: DEFAULT_SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'VND',
    },
  }
}


