export const version = 1;
export const buildDate = '<BUILD_DATE>';

export function getBuildDate() {
	if (buildDate.startsWith('<')) {
		const currentDate = new Date();
		return `${padded(currentDate.getFullYear())}-${padded(currentDate.getMonth())}-${padded(currentDate.getDate())}`;
	}
	return buildDate;
}

function padded(number: number, length: number = 2): string {
	return String(number).padStart(length, '0')
}
