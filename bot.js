require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { fetchUserOrders, fetchOrderById } = require('./strapi');

const { BOT_TOKEN, WEB_APP_URL } = process.env;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is missing in .env');
if (!WEB_APP_URL) throw new Error('WEB_APP_URL is missing in .env');

const bot = new Telegraf(BOT_TOKEN);

const WELCOME_MESSAGE = [
  'Вітаємо Вас у магазині сонцезахисних окулярів з досвідом роботи з 2000 року.',
  'Ми працюємо напряму з фабриками та точно знаємо, які моделі реально продаються в різних форматах торгівлі.',
].join('\n');

const SHORT_DESCRIPTION =
  'Магазин окулярів Furlux — стиль, що бачить світ твоїми очима 🕶️';

const LONG_DESCRIPTION = [
  'Вітаємо у Furlux — твоєму магазину окулярів у Telegram.',
  '',
  'Сонцезахисні, оптичні та трендові оправи на будь-який смак.',
  'Натисни «Запустити», щоб відкрити каталог і обрати свою пару.',
].join('\n');

const STATUS_LABELS = {
  pending: '⏳ Очікує обробки',
  processing: '🔧 Обробляється',
  shipped: '🚚 Відправлено',
  delivered: '✅ Доставлено',
  cancelled: '❌ Скасовано',
};

const PAYMENT_LABELS = {
  pending: '⏳ Очікує оплати',
  paid: '💳 Сплачено',
  failed: '⚠️ Помилка оплати',
};

const welcomeKeyboard = Markup.inlineKeyboard([
  [Markup.button.webApp('Переглянути всю колекцію', WEB_APP_URL)],
]);

const ORDERS_BTN = '📦 Мої замовлення';

// Reply-keyboard web_app buttons silently drop launch params on Telegram
// Desktop (macOS at least), opening the Mini App as "Невідомий користувач".
// The shop entry lives on the chat menu button (set via setChatMenuButton
// below) and on the inline button inside the welcome message — both of
// those *do* pass launch params correctly. So this reply keyboard now only
// holds plain text actions.
const persistentKeyboard = Markup.keyboard([
  [ORDERS_BTN],
]).resize();

// inputs {ctx}, sends welcome message with persistent reply keyboard + inline web_app button, returns Promise<Message>
const sendWelcome = (ctx) =>
  ctx.reply(WELCOME_MESSAGE, { ...welcomeKeyboard, ...persistentKeyboard });

// inputs {order}, formats single order summary line, returns string
const formatOrderLine = (order) => {
  const date = new Date(order.createdAt).toLocaleDateString('uk-UA');
  const status = STATUS_LABELS[order.orderStatus] || order.orderStatus;
  return `№${order.id} • ${date} • ${order.totalPrice} ${order.currency}\n${status}\nДеталі: /order_${order.id}`;
};

// inputs {order}, formats full order details, returns string
const formatOrderDetails = (order) => {
  const date = new Date(order.createdAt).toLocaleString('uk-UA');
  const status = STATUS_LABELS[order.orderStatus] || order.orderStatus;
  const payment = order.paymentStatus
    ? PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus
    : '—';

  const items = (order.items || [])
    .map((it) => `  • ${it.productName} ×${it.quantity} — ${it.price} ${order.currency}`)
    .join('\n');

  const delivery =
    order.deliveryMethod === 'nova-poshta-warehouse'
      ? `Нова Пошта, відділення №${order.warehouseNumber || '—'}`
      : `Нова Пошта, адресна доставка${order.streetAddress ? `: ${order.streetAddress}` : ''}`;

  return [
    `📦 Замовлення №${order.id}`,
    `🗓 ${date}`,
    '',
    `Статус: ${status}`,
    `Оплата: ${payment}`,
    '',
    'Товари:',
    items || '  —',
    '',
    `Сума: ${order.totalPrice} ${order.currency}`,
    '',
    `Отримувач: ${order.firstName} ${order.lastName}`,
    `Телефон: ${order.phone}`,
    `Місто: ${order.city}`,
    `Доставка: ${delivery}`,
  ].join('\n');
};

bot.start(sendWelcome);

// inputs {ctx}, fetches and replies with user orders, returns Promise<Message>
const handleOrders = async (ctx) => {
  try {
    const orders = await fetchUserOrders(ctx.from.id);
    if (orders.length === 0) {
      return ctx.reply('У тебе ще немає замовлень 🛍\nВідкрий каталог і обери першу пару окулярів!', welcomeKeyboard);
    }
    const header = `Твої останні замовлення (${orders.length}):\n`;
    const body = orders.map(formatOrderLine).join('\n\n');
    return ctx.reply(header + '\n' + body);
  } catch (err) {
    console.error('fetchUserOrders failed:', err);
    return ctx.reply('Не вдалося отримати замовлення. Спробуй пізніше 🙏');
  }
};

bot.command('orders', handleOrders);
bot.hears(ORDERS_BTN, handleOrders);

bot.hears(/^\/order_(\d+)$/, async (ctx) => {
  const orderId = ctx.match[1];
  try {
    const order = await fetchOrderById(orderId, ctx.from.id);
    if (!order) {
      return ctx.reply(`Замовлення №${orderId} не знайдено 🤷‍♂️`);
    }
    return ctx.reply(formatOrderDetails(order));
  } catch (err) {
    console.error('fetchOrderById failed:', err);
    return ctx.reply('Не вдалося отримати дані замовлення. Спробуй пізніше 🙏');
  }
});

bot.on('text', sendWelcome);

// inputs {}, registers commands menu and bot profile descriptions, returns Promise<void>
const setupBotProfile = async () => {
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Відкрити магазин окулярів' },
    { command: 'orders', description: 'Мої замовлення' },
  ]);
  await bot.telegram.setMyShortDescription(SHORT_DESCRIPTION);
  await bot.telegram.setMyDescription(LONG_DESCRIPTION);
  await bot.telegram.setChatMenuButton({
    menuButton: {
      type: 'web_app',
      text: 'Каталог',
      web_app: { url: WEB_APP_URL },
    },
  });
};

setupBotProfile()
  .then(() => {
    bot.launch();
    console.log('furlux-dev bot is running');
  })
  .catch((err) => {
    console.error('Failed to start bot:', err);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
