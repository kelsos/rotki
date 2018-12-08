from decimal import Decimal, InvalidOperation
from typing import Any, Union

# Here even though we got __future__ annotations using FVal does not seem to work
AcceptableFValInitInput = Union[float, bytes, Decimal, int, str, 'FVal']
AcceptableFValOtherInput = Union[int, 'FVal']


class FVal(object):
    """A value to represent numbers for financial applications. At the moment
    we use the python Decimal library but the abstraction will help us change the
    underlying implementation if needed.

    At the moment we do not allow any operations against floating points. Even though
    floating points could be converted to Decimals before each operation we will
    use this restriction to make sure floating point numbers are rooted from the codebase first.
    """

    __slots__ = ('num',)

    def __init__(self, data: AcceptableFValInitInput):
        try:
            if isinstance(data, float):
                self.num = Decimal(str(data))
            elif isinstance(data, bytes):
                # assume it's an ascii string and try to decode the bytes to one
                self.num = Decimal(data.decode())
            elif isinstance(data, (Decimal, int, str)):
                self.num = Decimal(data)
            elif isinstance(data, FVal):
                self.num = data.num
            else:
                self.num = None

        except InvalidOperation:
            raise ValueError(
                'Expected string, int, float, or Decimal to initialize an FVal.'
                'Found {}.'.format(type(data)),
            )

    def __str__(self) -> str:
        return str(self.num)

    def __repr__(self) -> str:
        return 'FVal({})'.format(str(self.num))

    def __gt__(self, other: AcceptableFValOtherInput) -> bool:
        evaluated_other = evaluate_input(other)
        return self.num.compare_signal(evaluated_other) == Decimal('1')

    def __lt__(self, other: AcceptableFValOtherInput) -> bool:
        evaluated_other = evaluate_input(other)
        return self.num.compare_signal(evaluated_other) == Decimal('-1')

    def __le__(self, other: AcceptableFValOtherInput) -> bool:
        evaluated_other = evaluate_input(other)
        return self.num.compare_signal(evaluated_other) in (Decimal('-1'), Decimal('0'))

    def __ge__(self, other: AcceptableFValOtherInput) -> bool:
        evaluated_other = evaluate_input(other)
        return self.num.compare_signal(evaluated_other) in (Decimal('1'), Decimal('0'))

    def __eq__(self, other: object) -> bool:
        evaluated_other = evaluate_input(other)
        return self.num.compare_signal(evaluated_other) == Decimal('0')

    def __add__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__add__(evaluated_other))

    def __sub__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__sub__(evaluated_other))

    def __mul__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__mul__(evaluated_other))

    def __truediv__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__truediv__(evaluated_other))

    def __floordiv__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__floordiv__(evaluated_other))

    def __pow__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__pow__(evaluated_other))

    def __radd__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__radd__(evaluated_other))

    def __rsub__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__rsub__(evaluated_other))

    def __rmul__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__rmul__(evaluated_other))

    def __rtruediv__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__rtruediv__(evaluated_other))

    def __rfloordiv__(self, other: AcceptableFValOtherInput):
        evaluated_other = evaluate_input(other)
        return FVal(self.num.__rfloordiv__(evaluated_other))

    def __float__(self) -> float:
        return float(self.num)

    # --- Unary operands

    def __neg__(self):
        return FVal(self.num.__neg__())

    def __abs__(self):
        return FVal(self.num.copy_abs())

    # --- Other operations

    def fma(self, other: AcceptableFValOtherInput, third: AcceptableFValOtherInput):
        """
        Fused multiply-add. Return self*other+third with no rounding of the
        intermediate product self*other
        """
        evaluated_other = evaluate_input(other)
        evaluated_third = evaluate_input(third)
        return FVal(self.num.fma(evaluated_other, evaluated_third))

    def to_percentage(self) -> str:
        return '{:.5%}'.format(self.num)

    def to_int(self, exact: bool) -> int:
        """Tries to convert to int, If `exact` is true then it will convert only if
        it is a whole decimal number; i.e.: if it has got nothing after the decimal point"""
        if exact and self.num.to_integral_exact() != self.num:
            raise ValueError('Tried to ask for exact int from {}'.format(self.num))
        return int(self.num)

    def is_close(self, other: AcceptableFValInitInput, max_diff: str = "1e-6") -> bool:
        evaluated_max_diff = FVal(max_diff)

        if not isinstance(other, FVal):
            other = FVal(other)

        diff_num = abs(self.num - other.num)
        return diff_num <= evaluated_max_diff.num


def evaluate_input(other: Any) -> Union[Decimal, int]:
    """Evaluate 'other' and return its Decimal representation"""
    if isinstance(other, FVal):
        return other.num
    elif not isinstance(other, int):
        raise NotImplementedError("Expected either FVal or int.")

    return other
