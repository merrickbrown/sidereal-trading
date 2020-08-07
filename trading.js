const SPECIES = {
	c : {name: 'Caylion Plutocracy', wants: 'sgTB'.split('')},
	e : {name: 'Eni Et Ascendancy', wants: 'Twos'.split('')},
	f : {name: 'Faderan Conclave', wants: 'wbg'.split('')},
	i : {name: "Im'dril Nomads", wants: 'oBb'.split('')},
	j : {name: 'Kjasjavikalimm Directorate', wants: 'YbT'.split('')},
	k : {name: "Kt'Zr'Kt'Rtl Adhocracy", wants: 'gYo'.split('')},
	u : {name: 'Unity', wants: []},
	y : {name: 'Yengii Society', wants: []},
	z : {name: 'Zeth Anocracy', wants: 'BwY'.split('')},
};

const RESOURCES = {
  b : {name: 'machinery (brown)', value: 2},
  w : {name: 'culture (white)', value: 2},
  g : {name: 'food (green)', value: 2},
  T : {name: 'biotech (blue)', value: 3},
  B : {name: 'information (black)', value: 3},
  Y : {name: 'energy (yellow)', value: 3},
  o : {name: 'ultratech (barrel)', value: 6},
  s : {name: 'ship', value: 2},
  x : {name: 'small wild (small grey)', value: 3},
  X : {name: 'large wild (large grey)', value: 4},
  a : {name: 'small cube', value: 2},
  A : {name: 'large cube', value: 3},
};

const COMMON_RESOURCES = ['b', 'w', 'g', 'T', 'B', 'Y', 'o', 's'];

const MAX_UNFAIRNESS = 3;

const unfairness = [0, 1, 2, 3];

const not = (X) => (x) => x !== X;

const is = (X) => (x) => x === X;

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** repeat the beginning of the array length times, removing the last element each time */
const stairs = (arr) => {
  if (arr.length <= 1) {
    return arr;
  }
  return arr.concat(stairs(arr.slice(0,-1)));
}

const repeat = (n) =>
  (arr) => Array.from({length: arr.length * n}).reduce((accum, _) => accum.concat(arr), []);

const reject = (p) =>
  (resource) => ({...p, rejections: p.rejections + 1, wants: p.wants.filter(not(resource))});

const accept = (p) => (resource) => ({...p, acceptances: p.acceptances + 1, wants: [...p.wants, resource]});

const cannot = (p) => (resource) => {
  return {...p, has: p.has.filter(not(resource))};
}

const handleOffer =  (player) => (resource) => (playerInfo) => (response) => {
  const result = {...playerInfo};
  result[player] = response(playerInfo[player])(resource);
  return result;
}

const setFinished = (player) => (playerInfo) => {
  const result = {...playerInfo};
  result[player].finished = true;
  return result;
}

const initPlayerInfo = (players) => Object.fromEntries(
  players.map(player => [
    player,
    {
      acceptances: 0,
      rejections: 0,
      finished: false,
      wants: SPECIES[player].wants,
      has: COMMON_RESOURCES
    }]));
    
const makeOffer = (turn) => (playerInfo) => (unfairness) => (offerFrom, offerTo) => {
  let toInfo = {...playerInfo[offerTo]};
  let needs = SPECIES[offerFrom].wants;
  let offering;
  if (offerFrom === 'y') {
    needs = [pickRandom(COMMON_RESOURCES)];
  }
  if (turn === 6) {
    needs = needs.filter(not('s'));
    toInfo.wants = toInfo.wants.filter(not('s'));
  }
  toInfo.wants = toInfo.wants.filter(not('x')).filter(not('X'));
  if (offerFrom === 'u') {
    offering = (Math.random() < 0.5) ? 'X' : 'x';
    needs = (offering === 'X') ? ['a', 'a', 'o'] : ['A', 'A', 'o'];
  }
  else {
    let offerPossibilities = repeat(3)(toInfo.wants) // include 3x wants
      .concat(COMMON_RESOURCES) // include common_resources
      .filter(r => !needs.includes(r)); // but not ones that we want
    offering = pickRandom(offerPossibilities);
  }
  
  const requesting = computeRequest(offerTo)(toInfo.has)(needs)(offering);
  
  return {...computeTrade(unfairness)(offering,requesting), offerTo, offerFrom};
}

const computeRequest = (offerTo) => (toHas) => (needs) => (offering) => {
  let myNeeds = [...needs];
  let needs_list = [];
  if (offerTo === 'u') {
    if (['w', 'b', 'b'].includes(offering)) {
      needs_list = [...needs_list, 'X', 'X', 'X'];
    }
    else if (['T', 'B', 'Y'].includes(offering)) {
      needs_list = [...needs_list, 'x', 'x', 'x'];
    }
    else if (['o'].includes(offering)) {
      needs_list = [...needs_list, 'x', 'X', 'x', 'X', 'x', 'X'];
    }
  }
  // move resources player has to end of needs
  let playerHas = Object.fromEntries(toHas.map(x => [x, true]));
  COMMON_RESOURCES.forEach(resource => {
    if (!playerHas[resource]) {
      const copies = myNeeds.filter(is(resource));
      const nons = myNeeds.filter(not(resource));
      myNeeds = nons.concat(copies);
    }
  })
  
  // pick a resource, generally from the front of the list
  needs_list = needs_list.concat(stairs(myNeeds));
  
  return pickRandom(needs_list);
}

const computeTrade = (unfairness) => (offering, requesting) => {
  let offer_value = RESOURCES[offering].value;
  let request_value = RESOURCES[requesting].value;
  
  const dealQuantities = computeQuantities(unfairness)(offer_value, request_value);
  
  return {
    offer: {
      quantity: dealQuantities.offer,
      resource: offering
    },
    request: {
      quantity: dealQuantities.request,
      resource: requesting
    }
  };
  
}

const computeQuantities = (unfairness) => (offer_value, request_value) => {
  let best_deal = {};
  let best_deal_difference = 1000;
  let unfairnessLevel = unfairness;
  if (request_value === offer_value && unfairnessLevel > 0 && unfairnessLevel < request_value) {
    unfairnessLevel = 0;
  }
  
  for (
    let offer_quantity = 1;
    offer_quantity <= 12/offer_value;
    offer_quantity++)
  {
    const total_offer_value = offer_value * offer_quantity + unfairness;
    for (let request_quantity = 1; request_quantity <= 6; request_quantity++) {
      let total_request_value = request_value * request_quantity;
      let current_deal_difference = total_request_value - total_offer_value;
      if (current_deal_difference < 0) {
        // too good a deal
        continue;
      }
      if (best_deal_difference > current_deal_difference) {
        best_deal = {offer: offer_quantity, request: request_quantity};
        best_deal_difference = current_deal_difference;
      }
      if (current_deal_difference === 0) {
        return best_deal;
      }
    }
  }
  
  return best_deal;
}

const allFinished = (playerInfo) => Object.keys(playerInfo).every(p => playerInfo[p].finished);

const getPlayers = (playerInfo) => Object.keys(playerInfo);

const capture = (f) => (args) => () => f.apply(null, args);

const generateTrade = (turn) => (playerInfo) =>  {
  let players = getPlayers(playerInfo);
	let tradingPartners = Object.keys(SPECIES).filter(p => !players.includes(p));
	let offer_to = pickRandom(players.filter(p => !playerInfo[p].finished));
	let offer_from = pickRandom(tradingPartners);
	let infoTo = playerInfo[offer_to];

	let unfairness = Math.floor((infoTo.acceptances + infoTo.rejections / 10) / (10 + turn));
	unfairness = Math.min(unfairness, MAX_UNFAIRNESS);

	// print species offers from to
	return makeOffer(turn)(playerInfo)(unfairness)(offer_from, offer_to);
}
