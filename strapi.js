const { STRAPI_API_URL, STRAPI_API_TOKEN } = process.env;

if (!STRAPI_API_URL) throw new Error('STRAPI_API_URL is missing in .env');
if (!STRAPI_API_TOKEN) throw new Error('STRAPI_API_TOKEN is missing in .env');

const authHeaders = { Authorization: `Bearer ${STRAPI_API_TOKEN}` };

// inputs {path}, calls Strapi REST API with auth, returns parsed JSON or throws
const strapiGet = async (path) => {
  const res = await fetch(`${STRAPI_API_URL}${path}`, { headers: authHeaders });
  if (!res.ok) {
    throw new Error(`Strapi ${res.status}: ${await res.text()}`);
  }
  return res.json();
};

// inputs {telegramId, limit}, fetches user orders sorted by newest, returns Order[]
const fetchUserOrders = async (telegramId, limit = 10) => {
  const params = new URLSearchParams({
    'filters[telegramUserId][$eq]': String(telegramId),
    'sort[0]': 'createdAt:desc',
    'pagination[pageSize]': String(limit),
  });
  const json = await strapiGet(`/api/orders?${params.toString()}`);
  return json.data || [];
};

// inputs {orderId, telegramId}, fetches single order ensuring ownership, returns Order or null
const fetchOrderById = async (orderId, telegramId) => {
  const params = new URLSearchParams({
    'filters[id][$eq]': String(orderId),
    'filters[telegramUserId][$eq]': String(telegramId),
    'pagination[pageSize]': '1',
  });
  const json = await strapiGet(`/api/orders?${params.toString()}`);
  return (json.data && json.data[0]) || null;
};

module.exports = { fetchUserOrders, fetchOrderById };
