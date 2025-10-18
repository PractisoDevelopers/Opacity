export default class Privileges {
	private _value: [number];
	readonly user: Primitive;
	readonly others: Primitive;
	constructor(matrix?: number) {
		this._value = [matrix ?? 0b1011];
		this.user = new Primitive(this._value);
		this.others = new Primitive(this._value, 2);
	}

	get value(): number {
		return this._value[0];
	}
}

class Primitive {
	private value: [number];
	private readonly offset: number;
	constructor(value: [number] = [0], offset: number = 0) {
		this.value = value;
		this.offset = offset;
	}
	get read(): boolean {
		return (0b10 & (this.value[0] >> this.offset)) == 0b10;
	}
	set read(enabled: boolean) {
		this.set(enabled, 0b10);
	}
	get write(): boolean {
		return (0b01 & (this.value[0] >> this.offset)) == 0b01;
	}
	set write(enabled: boolean) {
		this.set(enabled, 0b01);
	}

	private set(enabled: boolean, template: number) {
		if (enabled) {
			this.value[0] |= template << this.offset;
		} else {
			this.value[0] &= ~template << this.offset;
		}
	}
}
