import { Expression, ExpressionExtra } from '../interfaces';
import { hasFlag } from '../utils';

export const EMPTY_EXPRESSION = 0x1fffffff;

export function encodeExpression(expression: Expression | undefined): number {
	if (!expression)
		return EMPTY_EXPRESSION;

	const { extra, rightIris, leftIris, right, left, muzzle } = expression;

	// bits: 5 | 5 | 5 | 5 | 5 | 5 = 30/32
	return ((extra << 25) | (rightIris << 20) | (leftIris << 15) | (right << 10) | (left << 5) | muzzle) >>> 0;
}

export function decodeExpression(value: number): Expression | undefined {
	value = value >>> 0;

	if (value === EMPTY_EXPRESSION)
		return undefined;

	const muzzle = value & 0x1f;
	const left = (value >> 5) & 0x1f;
	const right = (value >> 10) & 0x1f;
	const leftIris = (value >> 15) & 0x1f;
	const rightIris = (value >> 20) & 0x1f;
	const extra = (value >> 25) & 0x1f;

	return { muzzle, left, right, leftIris, rightIris, extra };
}

export function isCancellableExpression(expression: Expression) {
	return hasFlag(expression.extra, ExpressionExtra.Zzz);
}
