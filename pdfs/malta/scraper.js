/*

 'https://eufunds.gov.mt/en/Operational%20Programmes/Programming%20Period%202014%20-%202020/Operational%20Programme%202/Documents/Approved%20Projects%202016/ESF%20Projects%20List%20October%202016.pdf',
 'https://eufunds.gov.mt/en/Operational%20Programmes/Programming%20Period%202014%20-%202020/Operational%20Programme%201/Documents/Approved%20Projects%202016/Online%20List%20of%20Beneficiaries_OPI%20ERDF%20Malta_PPCD_November_2016%20updated.pdf'

 */

var fs = require("fs");

var processLinesToRows = function (lines, itemcount) {
	var rows = [];
	for (var i = 0; i < itemcount; i++) rows.push([]);
	var index = 0;
	while (index < lines.length) {
		for (var i = 0; i < itemcount; i++) {
			rows[i].push(lines[index + i]);
		}
		index += itemcount + 1;
	}
	return rows;
};

var rowsToItems = function (rows, source) {
	return rows.map(function (row) {
		var o = {
			_source: source,
			project_ref_no: row[0],
			priority_axis: row[1],
			name_of_beneficiaries: row[2],
			ministry: row[3],
			name_of_operation: row[4],
			project_description: row[5],
			postcode: row[6],
			category_of_intervention: row[7],
			year_of_allocation: row[8].split(' ')[0],
			operation_start_date: row[8].split(' ')[1],
			operation_end_date: row[8].split(' ')[2],
			amounts_committed: row[9],
			total_amounts: row[10],
			cofinancing_rate: row[11]
		};
		return o;
	});
};

var lines = fs.readFileSync('ESF%20Projects%20List%20October%202016.txt').toString().split('\n');
var list = rowsToItems(processLinesToRows(lines, lines.indexOf('')), 'https://eufunds.gov.mt/en/Operational%20Programmes/Programming%20Period%202014%20-%202020/Operational%20Programme%202/Documents/Approved%20Projects%202016/ESF%20Projects%20List%20October%202016.pdf');
fs.writeFileSync('ESF%20Projects%20List%20October%202016.json', JSON.stringify(list, null, '\t'));


var list = [];
for (var i = 1; i < 4; i++) {
	var lines = fs.readFileSync('Online%20List%20of%20Beneficiaries_OPI%20ERDF%20Malta_PPCD_November_2016%20updated-page' + i + '.txt').toString().split('\n');
	var list1 = rowsToItems(processLinesToRows(lines, lines.indexOf('')),
		'https://eufunds.gov.mt/en/Operational%20Programmes/Programming%20Period%202014%20-%202020/Operational%20Programme%201/Documents/Approved%20Projects%202016/Online%20List%20of%20Beneficiaries_OPI%20ERDF%20Malta_PPCD_November_2016%20updated.pdf');
	list = list.concat(list1);
}

fs.writeFileSync('Online%20List%20of%20Beneficiaries_OPI%20ERDF%20Malta_PPCD_November_2016%20updated.json', JSON.stringify(list, null, '\t'));
