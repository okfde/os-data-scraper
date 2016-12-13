var fs = require('fs');
var data = require('./data.json');

var all = {};

data.forEach(function (item) {
	Object.keys(item).forEach(function (key) {
		all[key] = (all[key] || 0) + 1;
	});
});

var collect = Object.keys(all).map(function (key) {
	return {key: key, count: all[key]};
}).sort(function (a, b) {
	return b.count - a.count;
}).filter(function (item) {
	return (item.count > 5) && (item.key.indexOf('dokumenty_') < 0);
}).map(function (item) {
	return item.key;
});

data.forEach(function (item) {
	Object.keys(item).forEach(function (key) {
		if (collect.indexOf(key) < 0) delete item[key];

	});
});

fs.writeFileSync('data2.json', JSON.stringify(data, null, '\t'));
fs.writeFileSync('list.txt', collect.join('\n'));
// console.log(collect, collect.length);