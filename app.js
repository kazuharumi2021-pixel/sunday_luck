const MODES = {
  stats: [
    "📊 バランス統計",
    "奇数・偶数、大小、連番の偏りを整えて選びます。"
  ],
  luck: [
    "🍀 開運",
    "日付由来の数字を混ぜる縁起遊びです。"
  ],
  random: [
    "🎲 ランダム",
    "クイックピックのようにランダムで選びます。"
  ],
  mix: [
    "✨ MIX",
    "バランス・開運・ランダムを組み合わせます。"
  ]
};

const GAMES = {
  loto7: {
    name: "LOTO 7",
    count: 7,
    max: 37,
    cost: 300
  },
  loto6: {
    name: "LOTO 6",
    count: 6,
    max: 43,
    cost: 400
  },
  n4: {
    name: "NUMBERS 4",
    digits: 4,
    cost: 1000
  },
  n3: {
    name: "NUMBERS 3",
    digits: 3,
    cost: 1000
  }
};

const BONUS_GAMES = {
  mini: {
    name: "MINI LOTO",
    label: "ミニロト",
    price: 200,
    kind: "numbers"
  },
  bingo5: {
    name: "BINGO 5",
    label: "ビンゴ5",
    price: 200,
    kind: "bingo"
  },
  big: {
    name: "BIG",
    label: "BIG",
    price: 300,
    kind: "system"
  },
  toto: {
    name: "toto",
    label: "toto",
    price: 100,
    kind: "sports"
  },
  winner: {
    name: "WINNER",
    label: "WINNER",
    price: 200,
    kind: "sports"
  },
  basket: {
    name: "DUNK・バスケ系",
    label: "バスケ系くじ",
    price: 200,
    kind: "sports"
  }
};

let STATE =
  JSON.parse(
    localStorage.getItem("sl2") || "null"
  ) || {
    settings: {
      nt: "set"
    },
    weeks: []
  };

const $ = selector =>
  document.querySelector(selector);

const $$ = selector =>
  [...document.querySelectorAll(selector)];

function save() {
  localStorage.setItem(
    "sl2",
    JSON.stringify(STATE)
  );
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0")
  ].join("-");
}

function parseLocalDate(value) {
  return new Date(
    `${value}T00:00:00`
  );
}

function weekKey(date = new Date()) {
  const target =
    new Date(date);

  target.setDate(
    target.getDate() -
    target.getDay()
  );

  target.setHours(
    0,
    0,
    0,
    0
  );

  return dateKey(target);
}

function nextSundayKey(date = new Date()) {
  const target =
    new Date(date);

  const daysUntilSunday =
    (7 - target.getDay()) % 7;

  target.setDate(
    target.getDate() +
    daysUntilSunday
  );

  target.setHours(
    0,
    0,
    0,
    0
  );

  return dateKey(target);
}

function intendedWeekKey(date = new Date()) {
  const target =
    new Date(date);

  const day =
    target.getDay();

  /*
    金曜・土曜に翌週分を決めた場合は、
    次の日曜日を対象週にします。
  */
  if (
    day === 5 ||
    day === 6
  ) {
    return nextSundayKey(target);
  }

  return weekKey(target);
}

function migrateWeekData() {
  if (
    !STATE.settings
  ) {
    STATE.settings = {
      nt: "set"
    };
  }

  if (
    !Array.isArray(
      STATE.weeks
    )
  ) {
    STATE.weeks = [];
  }

  if (
    STATE.migrationVersion >= 2
  ) {
    return;
  }

  const oldWeek =
    STATE.weeks.find(
      week =>
        week.key ===
        "2026-10-25"
    );

  const newWeek =
    STATE.weeks.find(
      week =>
        week.key ===
        "2026-11-01"
    );

  /*
    今回の保存済みデータを
    2026年11月1日開始週へ補正します。
  */
  if (
    oldWeek &&
    !newWeek
  ) {
    oldWeek.originalKey =
      oldWeek.key;

    oldWeek.key =
      "2026-11-01";

    oldWeek.migratedAt =
      new Date()
        .toISOString();
  }

  for (
    const week of
    STATE.weeks
  ) {
    if (
      !Array.isArray(
        week.tickets
      )
    ) {
      week.tickets = [];
    }

    for (
      const ticket of
      week.tickets
    ) {
      if (
        !Array.isArray(
          ticket.checks
        )
      ) {
        ticket.checks = [];
      }
    }

    if (
      week.bonus &&
      !Array.isArray(
        week.bonus.checks
      )
    ) {
      week.bonus.checks = [];
    }
  }

  STATE.migrationVersion = 2;

  save();
}

migrateWeekData();

function currentWeek() {
  const todayKey =
    weekKey();

  const upcomingKey =
    intendedWeekKey();

  return (
    STATE.weeks.find(
      week =>
        week.key === todayKey
    ) ||
    STATE.weeks.find(
      week =>
        week.key === upcomingKey
    )
  );
}

function secureRandom(max) {
  if (
    !Number.isInteger(max) ||
    max <= 0
  ) {
    return 0;
  }

  const values =
    new Uint32Array(1);

  crypto.getRandomValues(
    values
  );

  return values[0] % max;
}

function uniqueNumbers(
  count,
  max,
  seeds = []
) {
  const result =
    new Set(
      seeds.filter(
        number =>
          Number.isInteger(number) &&
          number >= 1 &&
          number <= max
      )
    );

  while (
    result.size < count
  ) {
    result.add(
      secureRandom(max) + 1
    );
  }

  return [...result]
    .sort(
      (a, b) => a - b
    )
    .slice(
      0,
      count
    );
}

function balancedNumbers(
  count,
  max
) {
  let lastNumbers =
    uniqueNumbers(
      count,
      max
    );

  for (
    let attempt = 0;
    attempt < 300;
    attempt++
  ) {
    const numbers =
      uniqueNumbers(
        count,
        max
      );

    lastNumbers = numbers;

    const oddCount =
      numbers.filter(
        number =>
          number % 2 === 1
      ).length;

    const lowCount =
      numbers.filter(
        number =>
          number <=
          Math.floor(max / 2)
      ).length;

    const consecutiveCount =
      numbers.filter(
        (number, index) =>
          index > 0 &&
          number ===
          numbers[index - 1] + 1
      ).length;

    const oddBalanced =
      Math.abs(
        oddCount -
        count / 2
      ) <= 1;

    const lowBalanced =
      Math.abs(
        lowCount -
        count / 2
      ) <= 1;

    if (
      oddBalanced &&
      lowBalanced &&
      consecutiveCount <= 2
    ) {
      return numbers;
    }
  }

  return lastNumbers;
}

function luckyNumbers(
  count,
  max,
  weekDate = new Date()
) {
  const date =
    new Date(weekDate);

  const seeds = [
    date.getFullYear() % max,
    date.getMonth() + 1,
    date.getDate(),
    7,
    13
  ].map(
    number =>
      number === 0
        ? max
        : number
  );

  return uniqueNumbers(
    count,
    max,
    seeds
  );
}

function generateLotoNumbers(
  game,
  mode
) {
  if (
    mode === "stats"
  ) {
    return balancedNumbers(
      game.count,
      game.max
    );
  }

  if (
    mode === "luck"
  ) {
    return luckyNumbers(
      game.count,
      game.max
    );
  }

  if (
    mode === "mix"
  ) {
    const balanced =
      balancedNumbers(
        Math.ceil(
          game.count / 2
        ),
        game.max
      );

    const lucky =
      luckyNumbers(
        Math.max(
          2,
          Math.floor(
            game.count / 3
          )
        ),
        game.max
      );

    return uniqueNumbers(
      game.count,
      game.max,
      [
        ...balanced,
        ...lucky
      ]
    );
  }

  return uniqueNumbers(
    game.count,
    game.max
  );
}

function numbersType(gameId) {
  if (
    STATE.settings.nt ===
    "set"
  ) {
    return "セット";
  }

  const types =
    gameId === "n3"
      ? [
          "ストレート",
          "ボックス",
          "セット",
          "ミニ"
        ]
      : [
          "ストレート",
          "ボックス",
          "セット"
        ];

  return types[
    secureRandom(
      types.length
    )
  ];
}

function generateDigits(
  gameId,
  type
) {
  const length =
    GAMES[gameId].digits;

  const digits =
    Array.from(
      {
        length
      },
      () =>
        secureRandom(10)
    );

  if (
    (
      type === "セット" ||
      type === "ボックス"
    ) &&
    digits.every(
      digit =>
        digit === digits[0]
    )
  ) {
    digits[
      digits.length - 1
    ] =
      (
        digits[0] + 1
      ) % 10;
  }

  return digits;
}

function generateRegularTickets(
  mode
) {
  return Object.entries(
    GAMES
  ).map(
    ([gameId, game]) => {
      if (
        game.digits
      ) {
        const type =
          numbersType(
            gameId
          );

        return {
          id: gameId,
          name: game.name,
          numbers:
            generateDigits(
              gameId,
              type
            ),
          type:
            `${type}・週5回`,
          cost:
            game.cost,
          checks: []
        };
      }

      return {
        id: gameId,
        name: game.name,
        numbers:
          generateLotoNumbers(
            game,
            mode
          ),
        type:
          gameId === "loto6"
            ? "週2回"
            : "1回",
        cost:
          game.cost,
        checks: []
      };
    }
  );
}

function generateMiniLoto(
  mode
) {
  return generateLotoNumbers(
    {
      count: 5,
      max: 31
    },
    mode
  );
}

function generateBingo5() {
  const numberGroups = [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
    [11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20],
    [21, 22, 23, 24, 25],
    [26, 27, 28, 29, 30],
    [31, 32, 33, 34, 35],
    [36, 37, 38, 39, 40]
  ];

  return numberGroups.map(
    group =>
      group[
        secureRandom(
          group.length
        )
      ]
  );
}

function generateBonus(
  mode
) {
  const keys =
    Object.keys(
      BONUS_GAMES
    );

  const selectedKey =
    keys[
      secureRandom(
        keys.length
      )
    ];

  const game =
    BONUS_GAMES[
      selectedKey
    ];

  let numbers = [];
  let message = "";

  if (
    selectedKey === "mini"
  ) {
    numbers =
      generateMiniLoto(
        mode
      );

    message =
      "今週の作戦と同じ方式で、1〜31から異なる5個の数字を選びました。";
  } else if (
    selectedKey ===
    "bingo5"
  ) {
    numbers =
      generateBingo5();

    message =
      "8つの数字を1つずつ選びました。購入時に配置を確認してください。";
  } else if (
    selectedKey === "big"
  ) {
    message =
      "BIGを1口。数字は購入時にコンピューターが自動選択します。";
  } else if (
    selectedKey === "toto"
  ) {
    message =
      "今週はtotoに1口チャレンジ。対象試合と販売状況を購入時に確認してください。";
  } else if (
    selectedKey === "winner"
  ) {
    message =
      "今週はWINNERに1口チャレンジ。対象試合から購入するカードを選んでください。";
  } else {
    message =
      "今週はDUNK・バスケ系くじに1口チャレンジ。販売中の商品を確認してください。";
  }

  return {
    id: selectedKey,
    name: game.name,
    label: game.label,
    price: game.price,
    kind: game.kind,
    numbers,
    mode,
    locked: false,
    purchased: false,
    skipped: false,
    checks: [],
    created:
      new Date()
        .toISOString(),
    message
  };
}

function drawBonus() {
  const week =
    currentWeek();

  if (!week) {
    alert(
      "先に今週の作戦を抽選してください。"
    );

    return;
  }

  if (
    week.bonus &&
    week.bonus.locked
  ) {
    alert(
      "今週の＋1チャレンジは、すでに確定しています。"
    );

    return;
  }

  week.bonus =
    generateBonus(
      week.mode
    );

  save();
  render();
}

function lockBonus() {
  const week =
    currentWeek();

  if (
    !week ||
    !week.bonus
  ) {
    return;
  }

  week.bonus.locked =
    true;

  week.bonus.purchased =
    true;

  week.bonus.skipped =
    false;

  week.bonus.lockedAt =
    new Date()
      .toISOString();

  if (
    !Array.isArray(
      week.bonus.checks
    )
  ) {
    week.bonus.checks = [];
  }

  save();
  render();
}

function skipBonus() {
  const week =
    currentWeek();

  if (!week) {
    return;
  }

  week.bonus = {
    id: "skipped",
    name: "今週は見送り",
    label: "見送り",
    price: 0,
    kind: "skip",
    numbers: [],
    mode: week.mode,
    locked: true,
    purchased: false,
    skipped: true,
    checks: [],
    created:
      new Date()
        .toISOString()
  };

  save();
  render();
}

function resetSkippedBonus() {
  const week =
    currentWeek();

  if (!week) {
    return;
  }

  week.bonus = null;

  save();
  render();
}

function formatResultDetails(
  checks
) {
  if (
    !Array.isArray(checks) ||
    !checks.length
  ) {
    return "";
  }

  return checks
    .map(
      check => {
        const prize =
          Number(
            check.prize || 0
          );

        const rank =
          check.rank ||
          "はずれ";

        return `
          <div class="small">
            ${check.date || ""}
            第${check.draw || "-"}回：
            ${rank}
            ${
              prize > 0
                ? `・${prize.toLocaleString()}円`
                : ""
            }
          </div>
        `;
      }
    )
    .join("");
}

function renderBonus() {
  const area =
    $("#bonusArea");

  if (!area) {
    return;
  }

  const week =
    currentWeek();

  if (!week) {
    area.innerHTML = `
      <p class="small">
        先に今週の作戦を抽選すると、
        ＋1チャレンジを利用できます。
      </p>

      <button
        id="bonusDrawButton"
        class="secondary"
      >
        🎁 ＋1を抽選する
      </button>
    `;

    const button =
      $("#bonusDrawButton");

    if (button) {
      button.onclick =
        drawBonus;
    }

    return;
  }

  if (
    !week.bonus
  ) {
    area.innerHTML = `
      <p class="small">
        今週追加する候補を1つ抽選します。
        購入するかどうかは、抽選後に決められます。
      </p>

      <button
        id="bonusDrawButton"
        class="secondary"
      >
        🎁 ＋1を抽選する
      </button>
    `;

    const button =
      $("#bonusDrawButton");

    if (button) {
      button.onclick =
        drawBonus;
    }

    return;
  }

  const bonus =
    week.bonus;

  if (
    bonus.skipped
  ) {
    area.innerHTML = `
      <div class="ticket">
        <div class="ticketHead">
          <span>
            今週の＋1
          </span>

          <span class="tag">
            見送り
          </span>
        </div>

        <div class="result lose">
          今週の＋1チャレンジは見送りました。
        </div>

        <button
          id="bonusRetryButton"
          class="secondary"
        >
          やっぱり＋1を抽選する
        </button>
      </div>
    `;

    const retryButton =
      $("#bonusRetryButton");

    if (retryButton) {
      retryButton.onclick =
        resetSkippedBonus;
    }

    return;
  }

  let numbersHTML = "";

  if (
    Array.isArray(
      bonus.numbers
    ) &&
    bonus.numbers.length
  ) {
    numbersHTML = `
      <div class="balls">
        ${
          bonus.numbers
            .map(
              number => `
                <span class="ball">
                  ${
                    bonus.id === "mini"
                      ? String(number)
                          .padStart(2, "0")
                      : number
                  }
                </span>
              `
            )
            .join("")
        }
      </div>
    `;
  }

  const checks =
    Array.isArray(
      bonus.checks
    )
      ? bonus.checks
      : [];

  const totalPrize =
    checks.reduce(
      (sum, check) =>
        sum +
        Number(
          check.prize || 0
        ),
      0
    );

  let resultHTML = "";

  if (
    checks.length
  ) {
    resultHTML =
      totalPrize > 0
        ? `
            <div class="result">
              🎉 ＋1当せん
              ${totalPrize.toLocaleString()}円
            </div>
          `
        : `
            <div class="result lose">
              判定済み・当せんなし
            </div>
          `;

    resultHTML +=
      formatResultDetails(
        checks
      );
  }

  let purchaseGuide = "";

  if (
    bonus.id === "mini"
  ) {
    purchaseGuide =
      `ミニロト・1口 ${bonus.price}円`;
  } else if (
    bonus.id === "bingo5"
  ) {
    purchaseGuide =
      `ビンゴ5・1口 ${bonus.price}円`;
  } else {
    purchaseGuide =
      `${bonus.label}・1口の候補`;
  }

  const lockedHTML =
    bonus.locked
      ? `
          <div class="result">
            🔒 ＋1確定済み
            ${
              bonus.purchased
                ? `・${purchaseGuide}`
                : ""
            }
          </div>
        `
      : `
          <button
            id="bonusLockButton"
            class="primary"
          >
            🔒 ＋1もこれで買う
          </button>

          <button
            id="bonusRedrawButton"
            class="secondary"
          >
            🎲 別の＋1を抽選
          </button>

          <button
            id="bonusSkipButton"
            class="secondary"
          >
            今週は見送る
          </button>
        `;

  area.innerHTML = `
    <div class="ticket bonus-ticket">
      <div class="ticketHead">
        <span>
          🎁 ${bonus.name}
        </span>

        <span class="tag">
          ＋1
        </span>
      </div>

      ${numbersHTML}

      <p class="small">
        ${bonus.message || ""}
      </p>

      <p class="small">
        今週の方式：
        ${
          MODES[
            bonus.mode
          ]
            ? MODES[
                bonus.mode
              ][0]
            : "🎲 ランダム"
        }
      </p>

      <p class="small">
        ${purchaseGuide}
      </p>

      ${resultHTML}

      ${lockedHTML}
    </div>
  `;

  if (
    !bonus.locked
  ) {
    const lockButton =
      $("#bonusLockButton");

    const redrawButton =
      $("#bonusRedrawButton");

    const skipButton =
      $("#bonusSkipButton");

    if (lockButton) {
      lockButton.onclick =
        lockBonus;
    }

    if (redrawButton) {
      redrawButton.onclick =
        drawBonus;
    }

    if (skipButton) {
      skipButton.onclick =
        skipBonus;
    }
  }
}

function ticketHTML(
  ticket
) {
  const checks =
    Array.isArray(
      ticket.checks
    )
      ? ticket.checks
      : [];

  const totalPrize =
    checks.reduce(
      (sum, result) =>
        sum +
        Number(
          result.prize || 0
        ),
      0
    );

  let resultHTML = "";

  if (
    checks.length
  ) {
    resultHTML =
      totalPrize > 0
        ? `
            <div class="result">
              🎉 当せん合計
              ${totalPrize.toLocaleString()}円
            </div>
          `
        : `
            <div class="result lose">
              判定済み
              ${checks.length}回・当せんなし
            </div>
          `;

    resultHTML +=
      formatResultDetails(
        checks
      );
  }

  return `
    <div class="ticket">
      <div class="ticketHead">
        <span>
          ${ticket.name}
        </span>

        <span>
          ${ticket.type}
        </span>
      </div>

      <div class="balls">
        ${
          ticket.numbers
            .map(
              number => `
                <span class="ball">
                  ${number}
                </span>
              `
            )
            .join("")
        }
      </div>

      ${resultHTML}
    </div>
  `;
}

function render() {
  const week =
    currentWeek();

  if (!week) {
    $("#mode").textContent =
      "未抽選";

    $("#modeDesc").textContent =
      "4つのスタイルから今週の買い方を決めます。";

    $("#ticketCard")
      .classList
      .add("hidden");
  } else {
    $("#mode").textContent =
      MODES[
        week.mode
      ]
        ? MODES[
            week.mode
          ][0]
        : "🎲 ランダム";

    $("#modeDesc").textContent =
      MODES[
        week.mode
      ]
        ? MODES[
            week.mode
          ][1]
        : "";

    $("#ticketCard")
      .classList
      .remove("hidden");

    $("#tickets").innerHTML =
      week.tickets
        .map(
          ticketHTML
        )
        .join("");

    $("#lockTag").textContent =
      week.locked
        ? "確定済み"
        : "未確定";

    $("#lock").style.display =
      week.locked
        ? "none"
        : "block";

    $("#redraw").style.display =
      week.locked
        ? "none"
        : "block";
  }

  renderBonus();
  renderHistory();
  renderStats();
  renderRecent();
}

function renderHistory() {
  const historyList =
    $("#historyList");

  if (!historyList) {
    return;
  }

  if (
    !STATE.weeks.length
  ) {
    historyList.innerHTML = `
      <div class="card">
        まだ履歴がありません。
      </div>
    `;

    return;
  }

  historyList.innerHTML =
    STATE.weeks
      .map(
        week => {
          let bonusHTML = "";

          if (
            week.bonus &&
            week.bonus.purchased
          ) {
            const bonusNumbers =
              Array.isArray(
                week.bonus.numbers
              ) &&
              week.bonus.numbers.length
                ? `
                    <div class="balls">
                      ${
                        week.bonus.numbers
                          .map(
                            number => `
                              <span class="ball">
                                ${number}
                              </span>
                            `
                          )
                          .join("")
                      }
                    </div>
                  `
                : "";

            const bonusPrize =
              (
                week.bonus.checks || []
              ).reduce(
                (sum, check) =>
                  sum +
                  Number(
                    check.prize || 0
                  ),
                0
              );

            bonusHTML = `
              <div class="ticket">
                <div class="ticketHead">
                  <span>
                    🎁 ${week.bonus.name}
                  </span>

                  <span>
                    ＋1確定
                  </span>
                </div>

                ${bonusNumbers}

                ${
                  week.bonus.checks &&
                  week.bonus.checks.length
                    ? `
                        <div class="result ${
                          bonusPrize > 0
                            ? ""
                            : "lose"
                        }">
                          ${
                            bonusPrize > 0
                              ? `当せん ${bonusPrize.toLocaleString()}円`
                              : "判定済み・当せんなし"
                          }
                        </div>
                      `
                    : ""
                }
              </div>
            `;
          }

          return `
            <div class="hist">
              <b>
                ${week.key}
                ${
                  MODES[
                    week.mode
                  ]
                    ? MODES[
                        week.mode
                      ][0]
                    : ""
                }
              </b>

              ${
                week.tickets
                  .map(
                    ticketHTML
                  )
                  .join("")
              }

              ${bonusHTML}
            </div>
          `;
        }
      )
      .join("");
}

function allChecks() {
  const regularChecks =
    STATE.weeks.flatMap(
      week =>
        week.tickets.flatMap(
          ticket =>
            (
              ticket.checks || []
            ).map(
              check => ({
                ...check,
                mode: week.mode,
                gameId: ticket.id,
                bonus: false
              })
            )
        )
    );

  const bonusChecks =
    STATE.weeks.flatMap(
      week => {
        if (
          !week.bonus ||
          !week.bonus.purchased
        ) {
          return [];
        }

        return (
          week.bonus.checks || []
        ).map(
          check => ({
            ...check,
            mode: week.mode,
            gameId: week.bonus.id,
            bonus: true
          })
        );
      }
    );

  return [
    ...regularChecks,
    ...bonusChecks
  ];
}

function regularSpent() {
  return STATE.weeks
    .filter(
      week =>
        week.locked
    )
    .reduce(
      (
        total,
        week
      ) =>
        total +
        week.tickets.reduce(
          (
            ticketTotal,
            ticket
          ) =>
            ticketTotal +
            Number(
              ticket.cost || 0
            ),
          0
        ),
      0
    );
}

function bonusSpent() {
  return STATE.weeks.reduce(
    (
      total,
      week
    ) => {
      if (
        week.bonus &&
        week.bonus.purchased
      ) {
        return total +
          Number(
            week.bonus.price || 0
          );
      }

      return total;
    },
    0
  );
}

function renderStats() {
  const statsBox =
    $("#statsBox");

  if (!statsBox) {
    return;
  }

  const spent =
    regularSpent() +
    bonusSpent();

  const checks =
    allChecks();

  const prize =
    checks.reduce(
      (
        total,
        check
      ) =>
        total +
        Number(
          check.prize || 0
        ),
      0
    );

  const wins =
    checks.filter(
      check =>
        check.won === true ||
        Number(
          check.prize || 0
        ) > 0
    ).length;

  const bonusCount =
    STATE.weeks.filter(
      week =>
        week.bonus &&
        week.bonus.purchased
    ).length;

  const recoveryRate =
    spent > 0
      ? Math.round(
          prize /
          spent *
          100
        )
      : 0;

  statsBox.innerHTML = `
    <div class="stats">
      <div class="stat">
        購入総額
        <b>
          ${spent.toLocaleString()}円
        </b>
      </div>

      <div class="stat">
        当せん総額
        <b>
          ${prize.toLocaleString()}円
        </b>
      </div>

      <div class="stat">
        当せん回数
        <b>
          ${wins}回
        </b>
      </div>

      <div class="stat">
        回収率
        <b>
          ${recoveryRate}%
        </b>
      </div>

      <div class="stat">
        ＋1購入
        <b>
          ${bonusCount}回
        </b>
      </div>

      <div class="stat">
        ＋1購入額
        <b>
          ${bonusSpent().toLocaleString()}円
        </b>
      </div>
    </div>
  `;
}

function renderRecent() {
  const recent =
    $("#recent");

  if (!recent) {
    return;
  }

  const current =
    currentWeek();

  const previousWeeks =
    STATE.weeks
      .filter(
        week =>
          week.locked &&
          (
            !current ||
            week.key !== current.key
          )
      )
      .slice(
        0,
        2
      );

  if (
    !previousWeeks.length
  ) {
    recent.innerHTML = `
      <p class="small">
        確定した過去週がまだありません。
      </p>
    `;

    return;
  }

  recent.innerHTML =
    previousWeeks
      .map(
        week => `
          <div>
            <b>
              ${week.key}
            </b>

            ${
              week.tickets
                .map(
                  ticketHTML
                )
                .join("")
            }
          </div>
        `
      )
      .join("");
}

$("#draw").onclick = () => {
  const modeKeys =
    Object.keys(
      MODES
    );

  const mode =
    modeKeys[
      secureRandom(
        modeKeys.length
      )
    ];

  const targetKey =
    intendedWeekKey();

  STATE.weeks =
    STATE.weeks.filter(
      week =>
        week.key !==
        targetKey
    );

  STATE.weeks.unshift({
    key: targetKey,
    mode,
    locked: false,
    tickets:
      generateRegularTickets(
        mode
      ),
    bonus: null,
    created:
      new Date()
        .toISOString()
  });

  save();
  render();
};

$("#redraw").onclick = () => {
  const week =
    currentWeek();

  if (
    week &&
    !week.locked
  ) {
    week.tickets =
      generateRegularTickets(
        week.mode
      );

    save();
    render();
  }
};

$("#lock").onclick = () => {
  const week =
    currentWeek();

  if (!week) {
    return;
  }

  week.locked =
    true;

  week.lockedAt =
    new Date()
      .toISOString();

  save();
  render();
};

function sortedDigits(
  numbers
) {
  return [...numbers]
    .sort(
      (a, b) => a - b
    )
    .join("");
}

function judgeNumbers(
  ticket,
  draw
) {
  const purchased =
    ticket.numbers.join("");

  const winning =
    draw.main.join("");

  const type =
    ticket.type
      .replace(
        "・週5回",
        ""
      );

  const straight =
    purchased === winning;

  const box =
    sortedDigits(
      ticket.numbers
    ) ===
    sortedDigits(
      draw.main
    );

  let prizeType = null;

  if (
    type === "ストレート" &&
    straight
  ) {
    prizeType =
      "straight";
  }

  if (
    type === "ボックス" &&
    box
  ) {
    prizeType =
      "box";
  }

  if (
    type === "セット" &&
    straight
  ) {
    prizeType =
      "setStraight";
  } else if (
    type === "セット" &&
    box
  ) {
    prizeType =
      "setBox";
  }

  if (
    type === "ミニ" &&
    purchased.slice(-2) ===
    winning.slice(-2)
  ) {
    prizeType =
      "mini";
  }

  if (
    prizeType
  ) {
    return {
      rank: prizeType,
      prize:
        Number(
          draw.prizes?.[
            prizeType
          ] || 0
        ),
      won: true
    };
  }

  return {
    rank: "はずれ",
    prize: 0,
    won: false
  };
}

function judgeLoto(
  ticket,
  draw
) {
  const mainMatches =
    ticket.numbers.filter(
      number =>
        draw.main.includes(
          number
        )
    ).length;

  const bonusMatches =
    ticket.numbers.filter(
      number =>
        draw.bonus.includes(
          number
        )
    ).length;

  let rank = null;

  if (
    ticket.id === "loto6"
  ) {
    if (
      mainMatches === 6
    ) {
      rank = 1;
    } else if (
      mainMatches === 5 &&
      bonusMatches >= 1
    ) {
      rank = 2;
    } else if (
      mainMatches === 5
    ) {
      rank = 3;
    } else if (
      mainMatches === 4
    ) {
      rank = 4;
    } else if (
      mainMatches === 3
    ) {
      rank = 5;
    }
  } else {
    if (
      mainMatches === 7
    ) {
      rank = 1;
    } else if (
      mainMatches === 6 &&
      bonusMatches >= 1
    ) {
      rank = 2;
    } else if (
      mainMatches === 6
    ) {
      rank = 3;
    } else if (
      mainMatches === 5
    ) {
      rank = 4;
    } else if (
      mainMatches === 4
    ) {
      rank = 5;
    } else if (
      mainMatches === 3 &&
      bonusMatches >= 1
    ) {
      rank = 6;
    }
  }

  if (
    rank
  ) {
    return {
      rank:
        `${rank}等`,
      prize:
        Number(
          draw.prizes?.[
            String(rank)
          ] || 0
        ),
      won: true
    };
  }

  return {
    rank: "はずれ",
    prize: 0,
    won: false
  };
}

function judgeMiniLoto(
  bonus,
  draw
) {
  const mainMatches =
    bonus.numbers.filter(
      number =>
        draw.main.includes(
          number
        )
    ).length;

  const bonusMatches =
    bonus.numbers.filter(
      number =>
        draw.bonus.includes(
          number
        )
    ).length;

  let rank = null;

  if (
    mainMatches === 5
  ) {
    rank = 1;
  } else if (
    mainMatches === 4 &&
    bonusMatches >= 1
  ) {
    rank = 2;
  } else if (
    mainMatches === 4
  ) {
    rank = 3;
  } else if (
    mainMatches === 3
  ) {
    rank = 4;
  }

  if (
    rank
  ) {
    return {
      rank:
        `${rank}等`,
      prize:
        Number(
          draw.prizes?.[
            String(rank)
          ] || 0
        ),
      won: true
    };
  }

  return {
    rank: "はずれ",
    prize: 0,
    won: false
  };
}

function drawIsInWeek(
  draw,
  week
) {
  const startDate =
    parseLocalDate(
      week.key
    );

  const endDate =
    new Date(
      startDate
    );

  endDate.setDate(
    endDate.getDate() + 6
  );

  const drawDate =
    parseLocalDate(
      draw.date
    );

  return (
    drawDate >= startDate &&
    drawDate <= endDate
  );
}

function addRegularResults(
  week,
  resultData
) {
  let addedCount = 0;

  for (
    const ticket of
    week.tickets
  ) {
    if (
      !Array.isArray(
        ticket.checks
      )
    ) {
      ticket.checks = [];
    }

    const draws =
      (
        resultData[
          ticket.id
        ] || []
      ).filter(
        draw =>
          drawIsInWeek(
            draw,
            week
          )
      );

    for (
      const draw of draws
    ) {
      const alreadyChecked =
        ticket.checks.some(
          check =>
            check.draw ===
            draw.draw
        );

      if (
        alreadyChecked
      ) {
        continue;
      }

      const result =
        ticket.id.startsWith(
          "n"
        )
          ? judgeNumbers(
              ticket,
              draw
            )
          : judgeLoto(
              ticket,
              draw
            );

      ticket.checks.push({
        draw: draw.draw,
        date: draw.date,
        status: "done",
        rank: result.rank,
        prize: result.prize,
        won: result.won,
        main: draw.main,
        bonus:
          draw.bonus || []
      });

      addedCount++;
    }
  }

  return addedCount;
}

function addBonusResults(
  week,
  resultData
) {
  if (
    !week.bonus ||
    !week.bonus.purchased ||
    week.bonus.id !== "mini"
  ) {
    return 0;
  }

  if (
    !Array.isArray(
      week.bonus.checks
    )
  ) {
    week.bonus.checks = [];
  }

  let addedCount = 0;

  const draws =
    (
      resultData.mini || []
    ).filter(
      draw =>
        drawIsInWeek(
          draw,
          week
        )
    );

  for (
    const draw of draws
  ) {
    const alreadyChecked =
      week.bonus.checks.some(
        check =>
          check.draw ===
          draw.draw
      );

    if (
      alreadyChecked
    ) {
      continue;
    }

    const result =
      judgeMiniLoto(
        week.bonus,
        draw
      );

    week.bonus.checks.push({
      draw: draw.draw,
      date: draw.date,
      status: "done",
      rank: result.rank,
      prize: result.prize,
      won: result.won,
      main: draw.main,
      bonus:
        draw.bonus || []
    });

    addedCount++;
  }

  return addedCount;
}

async function syncResults() {
  const button =
    $("#syncBtn");

  if (button) {
    button.disabled = true;
  }

  $("#syncText").textContent =
    "最新データを確認中…";

  try {
    const response =
      await fetch(
        `data/results.json?v=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        "結果ファイルを取得できません"
      );
    }

    const resultData =
      await response.json();

    let addedCount = 0;

    for (
      const week of
      STATE.weeks.filter(
        item =>
          item.locked
      )
    ) {
      addedCount +=
        addRegularResults(
          week,
          resultData
        );

      addedCount +=
        addBonusResults(
          week,
          resultData
        );
    }

    STATE.lastSync =
      resultData.updated ||
      new Date()
        .toISOString();

    STATE.lastResultSource =
      resultData.source || "";

    save();
    render();

    $("#syncText").textContent =
      addedCount > 0
        ? `更新完了：新しく${addedCount}件を判定`
        : "更新完了：新しい判定結果はありません";
  } catch (error) {
    $("#syncText").textContent =
      `取得できません：${error.message}`;
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

$("#syncBtn").onclick =
  syncResults;

$("#saveSet").onclick = () => {
  const selected =
    $(
      '[name="nt"]:checked'
    );

  if (!selected) {
    return;
  }

  STATE.settings.nt =
    selected.value;

  save();

  alert(
    "設定を保存しました。"
  );
};

$$('[name="nt"]')
  .forEach(
    input => {
      input.checked =
        input.value ===
        STATE.settings.nt;
    }
  );

$$("nav button")
  .forEach(
    button => {
      button.onclick = () => {
        $$("nav button")
          .forEach(
            item =>
              item.classList.remove(
                "on"
              )
          );

        button.classList.add(
          "on"
        );

        $$(".page")
          .forEach(
            page =>
              page.classList.remove(
                "active"
              )
          );

        const target =
          $(
            `#${button.dataset.p}`
          );

        if (target) {
          target.classList.add(
            "active"
          );
        }

        render();
      };
    }
  );

$("#exportBtn").onclick = () => {
  const blob =
    new Blob(
      [
        JSON.stringify(
          STATE,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );

  const downloadUrl =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    downloadUrl;

  link.download =
    "sunday-luck-backup.json";

  link.click();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        downloadUrl
      ),
    1000
  );
};

$("#importFile").onchange =
  async event => {
    try {
      const file =
        event.target.files[0];

      if (!file) {
        return;
      }

      const importedState =
        JSON.parse(
          await file.text()
        );

      if (
        !importedState ||
        !Array.isArray(
          importedState.weeks
        )
      ) {
        throw new Error(
          "形式が正しくありません"
        );
      }

      STATE =
        importedState;

      if (
        !STATE.settings
      ) {
        STATE.settings = {
          nt: "set"
        };
      }

      STATE.migrationVersion = 0;

      migrateWeekData();
      save();
      render();

      alert(
        "バックアップを読み込みました。"
      );
    } catch (error) {
      alert(
        `読み込めませんでした：${error.message}`
      );
    }
  };

window.addEventListener(
  "load",
  () => {
    migrateWeekData();
    render();
    syncResults();
  }
);

if (
  "serviceWorker" in
  navigator
) {
  navigator.serviceWorker
    .register(
      `sw.js?v=3`
    )
    .then(
      registration =>
        registration.update()
    )
    .catch(
      error =>
        console.log(
          "Service Worker:",
          error
        )
    );
}
