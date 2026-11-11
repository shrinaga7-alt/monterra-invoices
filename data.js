// Starting data that is safe to publish: the product list only.
// Business, client, bank and price details come from seed.private.js (local only) or from your backup.
(function (root) {
  let SEED = null;
  if (typeof module !== 'undefined') { try { SEED = require('./seed.private.js'); } catch (e) { SEED = null; } }
  else SEED = root.MONTERRA_SEED || null;

  const products = [
    { id: 'tiramisu', name: 'Tiramisu Tub', desc: '200 ml · savoiardi, coffee cremeux, mascarpone mousse', aliases: ['tiramisu', 'tiramisu tub'], tray: 12 },
    { id: 'mango-mousse', name: 'Mango Mousse', desc: '150 g · fresh mango cremeux, whipped cream, vanilla crumb', aliases: ['mango mousse', 'mango'] },
    { id: 'rocky-tub', name: 'Rocky Road Tub', desc: '200 ml · chocolate cake, ganache, cookie chunks, brownie bits, marshmallow, almonds, mousse', aliases: ['rocky road', 'rocky road tub'] },
    { id: 'rocky-cup', name: 'Rocky Road Cup', desc: '150 g · chocolate cake, ganache, cookie chunks, brownie bits, marshmallow, almonds, mousse', aliases: ['rocky road', 'rocky road cup'] },
    { id: 'choc-tub', name: 'Chocolate Cake Tub', desc: '200 ml · two-layer chocolate cake with dark chocolate frosting', aliases: ['chocolate cake tub', 'choco cake tub', 'chocolate tub'] },
    { id: 'brownie', name: 'Dark Chocolate Fudge Brownie', desc: '100 g · dense, fudgy, intensely chocolatey · eggless', aliases: ['brownie', 'fudge brownie', 'dark chocolate brownie', 'dark chocolate fudge brownie'] },
    { id: 'strawberry', name: 'Strawberry Garden Cheesecake Cup', desc: '150 g · vanilla crumb, cream cheese diplomat, strawberry jelly, honey crumbs', aliases: ['strawberry garden', 'garden strawberry', 'strawberry cheesecake', 'strawberry garden cake', 'strawberry'] },
    { id: 'biscoff-cup', name: 'Biscoff Cheesecake Cup', desc: '', aliases: ['biscoff', 'biscoff cheesecake'] },
    { id: 'caramel-cheese-custard', name: 'Caramel Cheese Custard', desc: '', aliases: ['caramel cheese custard', 'cheese custard'] },
    { id: 'caramel-custard', name: 'Caramel Custard', desc: '', aliases: ['caramel custard', 'custard'] },
    { id: 'sticky-date', name: 'Sticky Date Cake (with toffee sauce)', desc: '200 ml · eggless date cake, toffee glaze', aliases: ['sticky date', 'sticky date cake', 'date cake'] },
    { id: 'carrot-whole', name: 'Carrot Cake with Cream Cheese (whole, 6″)', desc: '750 g · spiced carrot sponge, walnut, house-made cream cheese frosting · pre-sliced into 6 pcs', aliases: ['carrot cake', 'carrot cake whole', 'whole carrot cake'], slices: 6 },
    { id: 'carrot-tub', name: 'Carrot Cake with Cream Cheese (tub)', desc: '200 ml · spiced carrot cake, cream cheese frosting', aliases: ['carrot cake tub', 'carrot tub'] },
    { id: 'choc-whole', name: 'Chocolate Cake (whole, 6″)', desc: '~1 kg · two-layer cake, dark chocolate ganache frosting · pre-sliced into 6 pcs', aliases: ['chocolate cake', 'chocolate cake whole', 'whole chocolate cake'], slices: 6 },
    { id: 'choc-slice', name: 'Chocolate Cake (slice)', desc: '', aliases: ['chocolate cake slice', 'chocolate slice'] },
    { id: 'lemon-berry', name: 'Lemon Berry Cake (whole, 6″)', desc: '~1 kg · lemon sponge, berry compote, cream cheese frosting · pre-sliced into 6 pcs', aliases: ['lemon berry', 'lemon berry cake', 'lemon cake'], slices: 6 },
    { id: 'blueberry-crumble', name: 'Blueberry Crumble Cake', desc: 'buttery crumble base, blueberry compote, streusel top', aliases: ['blueberry crumble', 'blueberry', 'crumble'] },
    { id: 'basque-classic', name: 'Classic Burnt Basque Cheesecake (whole, 6″)', desc: '~1 kg · classic Basque, caramelised top · 6–8 slices', aliases: ['basque', 'burnt basque', 'basque cheesecake', 'classic basque'], slices: 6 },
    { id: 'basque-coffee-6', name: 'Coffee Burnt Basque Cheesecake (whole, 6″)', desc: '', aliases: ['coffee basque', 'coffee basque 6'] },
    { id: 'basque-coffee-7', name: 'Coffee Burnt Basque Cheesecake (whole, 7″)', desc: '', aliases: ['coffee basque 7'] },
    { id: 'basque-matcha', name: 'Matcha Burnt Basque Cheesecake (whole, 6″)', desc: '', aliases: ['matcha basque', 'matcha'] },
    { id: 'no-bake', name: 'No-Bake Cheesecake (whole, 6″)', desc: '~1 kg · Biscoff-crumb base, set cream cheese layer · eggless', aliases: ['no bake cheesecake', 'cheesecake', 'no bake'] },
    { id: 'chai-tres', name: 'Chai Coconut Tres Leches (tray, 12 pcs)', desc: '', aliases: ['chai tres leches', 'chai coconut tres leches'] },
    { id: 'mango-tres', name: 'Mango Tres Leches Tub', desc: '200 ml · vanilla sponge, three-milk soak, fresh mango', aliases: ['mango tres leches', 'tres leches'] },
    { id: 'brownie-frosted', name: 'Eggless Brownie with Cream Cheese Frosting', desc: '100 g brownie + cream cheese frosting topping · eggless', aliases: ['frosted brownie', 'brownie with cream cheese', 'brownie cream cheese frosting'] },
    { id: 'pannacotta', name: 'Basil Pannacotta with Strawberry Compote', desc: '', aliases: ['pannacotta', 'basil pannacotta'] },
    { id: 'focaccia', name: 'Roasted Tomato Focaccia', desc: 'rustic focaccia, slow-roasted tomato, herbs', aliases: ['focaccia', 'tomato focaccia', 'foccacia'] },
    { id: 'chicken-bun', name: 'Chicken Potato Cream Cheese Bun', desc: '80 g · Korean-style soft bun, chicken, mashed potato, cream cheese', aliases: ['chicken bun', 'chicken potato bun'] },
    { id: 'mushroom-bun', name: 'Mushroom Bechamel Bun', desc: '80 g · Korean-style soft bun, sautéed mushroom, bechamel', aliases: ['mushroom bun', 'mushroom bechamel bun'] },
    { id: 'chicken-stuffed-bun', name: 'Chicken Cream Cheese Stuffed Bun', desc: '120 g · savoury chicken filling, in-house cream cheese, brioche bun · non-veg', aliases: ['chicken bun', 'chicken stuffed bun', 'chicken cream cheese bun'] },
    { id: 'mushroom-stuffed-bun', name: 'Mushroom Cream Cheese Stuffed Bun', desc: '120 g · sauteed mushroom, in-house cream cheese, brioche bun · veg', aliases: ['mushroom bun', 'mushroom stuffed bun', 'mushroom cream cheese bun'] },
    { id: 'korean-bun', name: 'Classic Korean Cream Cheese Bun', desc: '120 g · soft Korean-style bun, sweet-savoury cream cheese filling', aliases: ['korean bun', 'cream cheese bun', 'korean cream cheese bun'] },
    { id: 'peach-puff', name: 'Peach Puff', desc: '', aliases: ['peach puff', 'peach'] },
    { id: 'mushroom-puff', name: 'Mushroom Puff', desc: '', aliases: ['mushroom puff'] },
    { id: 'tomato-puff', name: 'Roasted Tomato Puff', desc: '', aliases: ['tomato puff', 'roasted tomato puff'] },
    { id: 'pistachio-puff', name: 'Pistachio Cream Cheese Puff', desc: '', aliases: ['pistachio puff', 'pistachio'] },
    { id: 'shortbread', name: 'Shortbread', desc: '', aliases: ['shortbread', 'short bread'] },
    { id: 'caramel-dc-cookie', name: 'Caramel Double Chocolate Cookie', desc: '100 g · soft-baked, stuffed caramel centre', aliases: ['caramel cookie', 'caramel double chocolate', 'double chocolate caramel cookie', 'caramel double chocolate cookie'] },
    { id: 'mcss-stuffed', name: 'Milk Chocolate Sea Salt Stuffed Cookie', desc: '100 g · molten milk chocolate centre, flaky sea salt', aliases: ['sea salt cookie', 'milk chocolate sea salt', 'sea salt stuffed', 'milk chocolate stuffed cookie'] },
    { id: 'mcss-plain', name: 'Milk Chocolate Sea Salt Cookie (unstuffed)', desc: '50 g · milk chocolate chips, flaky sea salt finish · unstuffed', aliases: ['unstuffed', 'sea salt unstuffed', 'unstuffed cookie'] },
    { id: 'triple-choc', name: 'Triple Chocolate Stuffed Cookie', desc: '100 g · dark cookie stuffed with white chocolate, crushed Oreo finish', aliases: ['triple chocolate', 'triple chocolate cookie'] },
    { id: 'oatmeal', name: 'Oatmeal Cookie', desc: '100 g · toasted oats, dried cranberries, hint of warm spice', aliases: ['oatmeal', 'oatmeal cookie', 'oats cookie'] },
    { id: 'oat-berry', name: 'Oat Berry White Chocolate Cookie', desc: '', aliases: ['oat berry', 'oat berry cookie'] },
    { id: 'classic-dcc', name: 'Classic Dark Chocolate Chip Cookie', desc: '50 g · buttery, dark chocolate chunks', aliases: ['chocolate chip cookie', 'dark chocolate chip', 'classic cookie', 'choco chip'] },
    { id: 'double-choc-cookie', name: 'Double Chocolate Cookie', desc: '', aliases: ['double chocolate cookie'] },
    { id: 'milk-choc-chip', name: 'Milk Chocolate Chip Cookie', desc: '100 g · milk chocolate chunks, flaky sea salt finish', aliases: ['milk chocolate chip', 'milk chocolate cookie'] },
    { id: 'choc-chip-100', name: 'Chocolate Chip Cookie', desc: '100 g · buttery dough, chocolate chips', aliases: ['chocolate chip cookie', 'choco chip', 'cookie', 'cookies'] },
    { id: 'choc-chip-100-eggless', name: 'Chocolate Chip Cookie (eggless)', desc: '100 g · buttery dough, chocolate chips · eggless', aliases: ['eggless cookie', 'eggless chocolate chip'] },
    { id: 'dough-dc', name: 'Double Chocolate Cookie Dough', desc: '1 kg · raw chilled dough, portion & bake in-house', aliases: ['double chocolate dough', 'dc dough'] },
    { id: 'dough-mc', name: 'Milk Chocolate Cookie Dough', desc: '1 kg · raw chilled dough, portion & bake in-house', aliases: ['milk chocolate dough', 'mc dough'] },
  ];

  const blankBusiness = {
    name: '', addr: [], gstin: '', cin: '', gpay: '', acHolder: '', acNo: '', acType: 'Current', bank: '', branch: '', ifsc: '',
    upi: '', upiName: '', note: 'Storage: refrigerate at 2–4°C. Best within 3–4 days.', prefix: 'MF', hsn: '1905',
  };
  const DEFAULTS = {
    version: 1, products,
    business: SEED ? SEED.business : blankBusiness,
    clients: SEED ? SEED.clients : [],
    payers: SEED ? SEED.payers : {},
    owner: SEED ? SEED.owner : [],
  };
  if (typeof module !== 'undefined') module.exports = DEFAULTS; else root.MONTERRA_DEFAULTS = DEFAULTS;
})(this);
