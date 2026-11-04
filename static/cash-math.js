// Single-street, heads-up teaching models; no rake, raises or future bets.
(function () {
  const amount = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error("金额必须是有限的非负数");
    return number;
  };
  globalThis.CashMath = {
    calculate(pot, bet, folds, showdown, stack) {
      pot = amount(pot); bet = amount(bet); stack = amount(stack);
      folds = amount(folds); showdown = amount(showdown);
      if (pot <= 0) throw new Error("下注前底池必须大于零");
      if (folds > 100 || showdown > 100) throw new Error("百分比须在 0–100 之间");
      const f = folds / 100;
      return {
        callEquity: bet / (pot + 2 * bet),
        bluffFolds: bet / (pot + bet),
        mdf: pot / (pot + bet),
        bluffEV: f * pot - (1 - f) * bet,
        checkEV: pot * showdown / 100,
        spr: stack / pot,
      };
    },
  };
})();
