import dic from "./dictionary/pt-br.js";
import debugAttempts from "./debugging/attemps.js";

new Vue({
    el: "#app",
    data: {
        Constants: {
            DEBUG: false,
            COLOR_RED: "R",
            COLOR_YELLOW: "Y",
            COLOR_GREEN: "G",
        },
        attempts: [],
        suggestedNextWords: [],
        guessedCorrectly: false,
        settings: {
            lettersMayRepeat: true,
            showScore: false,
            suggestionCount: 15
        },
        keyboard: {
            firstRow: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
            secondRow: ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
            thirdRow: ["Z", "X", "C", "V", "B", "N", "M"],
        }
    },

    filters: {
        formatScore(score) {
            return (Math.round(score * 100) / 100).toFixed(2);
        }
    },

    computed: {
        dicWords: function () {
            return dic.words;
        },

        debugAttempts: function () {
            return debugAttempts;
        },

        nextSuggestedWords: function () {
            this.debug(`${this.suggestedNextWords.length} words --> \n ${this.suggestedNextWords.map((w) => `${w.word} (${w.score}) `)}`);
            this.sortByScore()
            return this.suggestedNextWords.slice(0, this.settings.suggestionCount);
        },
    },

    mounted() {
        this.mapKeyboardKeyPress();
        this.reset();
        //this.attempts = this.debugAttempts; // For testing
        this.check();
    },

    destroyed: function () { },

    methods: {
        mapKeyboardKeyPress() {
            window.addEventListener('keydown', (e) => {
                const KEY_CODE_BACKSPACE = 8;
                const KEY_CODE_DELETE = 46;

                let char = String.fromCharCode(e.keyCode);
                if (this.isLetter(char) && e.key.length == 1) {
                    this.useLetter(char);
                    this.check();
                }

                if (e.keyCode == KEY_CODE_BACKSPACE || e.keyCode == KEY_CODE_DELETE) {
                    this.backspace();
                    this.check();
                }
            });
        },

        changeColor(letter) {
            let newColor =
                letter.color == this.Constants.COLOR_GREEN
                    ? this.Constants.COLOR_YELLOW
                    : letter.color == this.Constants.COLOR_YELLOW
                        ? this.Constants.COLOR_RED
                        : this.Constants.COLOR_GREEN;

            letter.color = newColor;
        },

        getCssColor(letter) {
            let cssClass = "letter ";

            if (letter.letter) {
                cssClass +=
                    letter.color == this.Constants.COLOR_GREEN
                        ? "green"
                        : letter.color == this.Constants.COLOR_YELLOW
                            ? "yellow"
                            : "red";
            }

            return cssClass;
        },

        getFontSizePercentage(index) {
            const MAX_PERCENTAGE = 120;
            const MIN_PERCENTAGE = 50;

            let perc = MAX_PERCENTAGE;
            let numberOfSuggestions = this.nextSuggestedWords.length;
            if (index > 0) {
                perc = (numberOfSuggestions - index) / numberOfSuggestions * 100;
                perc = parseInt(perc);
                if (perc < MIN_PERCENTAGE) {
                    perc = MIN_PERCENTAGE;
                }
            }

            return `font-size:${perc}%;`;
        },

        reset() {
            this.attempts = [];
            for (let i = 1; i <= 5; i++) {
                this.attempts.push({
                    number: i,
                    letters: [
                        { position: 1, letter: "", color: this.Constants.COLOR_RED },
                        { position: 2, letter: "", color: this.Constants.COLOR_RED },
                        { position: 3, letter: "", color: this.Constants.COLOR_RED },
                        { position: 4, letter: "", color: this.Constants.COLOR_RED },
                        { position: 5, letter: "", color: this.Constants.COLOR_RED },
                    ]
                });
            }
        },

        check() {
            // Check if there was any attempt so far
            this.suggestedNextWords = [];
            if (this.attempts.length == 0) {
                return;
            }

            // Initialize suggested next words
            this.suggestedNextWords = this.dicWords.map(function (item) {
                return {
                    word: item.w,
                    uses: item.u,
                    score: 0
                };
            });

            // Iterate thru each filled attempt to suggest next words
            this.attempts
                .filter((a) => this.isAttemptFilled(a))
                .forEach((attempt) => {
                    attempt.letters.forEach((letter) => {
                        this.suggestedNextWords = this.filterByWord(letter, attempt);
                    });
                    this.debug('----------------------------------------------------------------------------------------------------');
                });

            // Build the score and sorts the array using it
            this.suggestedNextWords = this.buildScore(this.suggestedNextWords);

            // Check if guessed correctly
            this.guessedCorrectly = this.checkIfGuessedCorrectly();
        },

        checkIfGuessedCorrectly: function () {
            let allFilledAttempts = this.attempts.filter((a) => this.isAttemptFilled(a));
            if (allFilledAttempts.length == 0) {
                return false;
            }

            let lastFilledAttempt = allFilledAttempts.slice(-1)[0];
            return lastFilledAttempt.letters.filter(l => l.color != this.Constants.COLOR_GREEN).length == 0;
        },

        sortByScore() {
            this.suggestedNextWords = this.suggestedNextWords.sort((a, b) => (a.score < b.score) ? 1 : (a.score > b.score ? -1 : 0));
        },

        buildScore(suggestedWords) {
            const POINTS = 10;

            let alreadyTestedVowels = this.attempts
                .filter((attempt) => this.isAttemptFilled(attempt))
                .reduce(function (a, b) { return a.concat(b.letters) }, [])
                .map((attempt) => attempt.letter)
                .filter((letter) => letter.match(/[aeiou]/gi));

            suggestedWords.forEach((suggestion) => {
                let chars = suggestion.word.split('');

                // [Adds points] Number of vowels
                let uniqueLetters = [...new Set(chars)].join('');
                suggestion.score += (this.countByRegex(uniqueLetters, /[aeiou]/gi) * POINTS)

                // [Removes points] Number of repeated letters
                let repeatedLettersCount = suggestion.word.length - uniqueLetters.length;
                suggestion.score -= repeatedLettersCount * POINTS;

                // [Adds points] Uses in language
                let scoreForUsage = isNaN(suggestion.uses) ? 0 : suggestion.uses * 0.01;
                if (scoreForUsage > POINTS) {
                    scoreForUsage = POINTS;
                }
                suggestion.score += scoreForUsage;

                // [Adds points] Check if word has vowels not tested yet
                let suggestionVowels = suggestion.word.match(/[aeiou]/gi);
                if (suggestionVowels) {
                    let every = suggestionVowels.every(item => alreadyTestedVowels.includes(item))
                    if (!every) {
                        suggestion.score += POINTS;
                    }
                }

                // [Adds points] Word has most frequent consonants in language
                let mostFrequentConsonantsInLanguage = suggestion.word.match(dic.mostFrequentConsonantsRegex);
                if (mostFrequentConsonantsInLanguage != null) {
                    suggestion.score += POINTS;
                }
            });

            return suggestedWords;
        },

        countByRegex(str, regex) {
            let re = str.match(regex);
            return (re === null ? 0 : re.length);
        },

        filterByWord(letter, attempt) {
            let filteredSuggestions = this.suggestedNextWords;
            letter.letter = this.sanitizeLetter(letter.letter);
            let log = `Pos. #${letter.position} Letter '${letter.letter}' Color '${letter.color}' `;

            if (letter.color == this.Constants.COLOR_RED) {
                // Check if the letter is already present as green/yellow in any other position
                let isPresent = attempt.letters
                    .filter(l =>
                        l.position != letter.position &&
                        l.letter == letter.letter &&
                        (l.color == this.Constants.COLOR_GREEN || l.color == this.Constants.COLOR_YELLOW)
                    ).length > 0;

                if (!isPresent) {
                    log += `Remove all words that contains the letter '${letter.letter}' in any position.`;
                    filteredSuggestions = filteredSuggestions.filter(
                        (a) => !a.word.includes(letter.letter)
                    );
                }
                else {
                    log += `Letter already present. Keep only words which position ${letter.position} is different from '${letter.letter}'.`;
                    filteredSuggestions = filteredSuggestions.filter(
                        (a) => a.word.substr(letter.position - 1, 1) != letter.letter
                    );
                }
            }

            if (letter.color == this.Constants.COLOR_YELLOW) {
                log += `Keep only words that contains the letter '${letter.letter}' somewhere and which position ${letter.position} is different from '${letter.letter}'.`;
                filteredSuggestions = filteredSuggestions.filter(
                    (a) =>
                        a.word.includes(letter.letter) &&
                        a.word.substr(letter.position - 1, 1) != letter.letter
                );
            }

            if (letter.color == this.Constants.COLOR_GREEN) {
                log += `Keep only words which position ${letter.position} is equal to '${letter.letter}'.`;
                filteredSuggestions = filteredSuggestions.filter(
                    (a) => a.word.substr(letter.position - 1, 1) == letter.letter
                );

                if (!this.settings.lettersMayRepeat) {
                    log += `Keep only words which positions other than ${letter.position} is different from '${letter.letter}'.`;
                    for (let indexPos = 1; indexPos <= 5; indexPos++) {
                        if (indexPos != letter.position) {
                            filteredSuggestions = filteredSuggestions.filter(
                                (a) => a.word.substr(indexPos - 1, 1) != letter.letter
                            );
                        }
                    }
                }
            }

            this.debug(log);
            return filteredSuggestions;
        },

        sanitizeLetter(letter) {
            return letter.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        },

        isAttemptFilled(attempt) {
            return attempt.letters.filter(l => !l.letter || !l.color).length == 0;
        },

        isLetter(char) {
            return (/^[A-Za-z]+$/.test(char));
        },

        useWord(word) {
            let nextEmptyAttempt = this.findNextEmptyAttempt();
            if (!nextEmptyAttempt) {
                return;
            }

            let lastFilledAttempt = this.attempts.find((a) => a.number == nextEmptyAttempt.number - 1);

            const wordChars = word.split('');
            nextEmptyAttempt.letters.forEach((letter, index) => {
                letter.letter = wordChars[index];
                if (lastFilledAttempt) {
                    if (lastFilledAttempt.letters[index].letter == letter.letter) {
                        letter.color = lastFilledAttempt.letters[index].color;
                    }
                }
            });
        },

        useLetter(letter) {
            let nextEmptyAttempt = this.findNextEmptyAttempt();
            if (!nextEmptyAttempt) {
                return;
            }

            let nextEmptyLetter = nextEmptyAttempt.letters.find((l) => !l.letter);
            if (!nextEmptyLetter) {
                return;
            }

            nextEmptyLetter.letter = letter;
        },

        backspace() {
            let attemptsWithLetters = this.attempts.filter(attempt => attempt.letters.filter(l => l.letter != "").length > 0);
            if (!attemptsWithLetters || attemptsWithLetters.length == 0) {
                return;
            }

            let mostRecentAttempt = attemptsWithLetters[attemptsWithLetters.length - 1];
            let mostRecentLetter = mostRecentAttempt.letters.filter(l => l.letter).slice(-1)[0];
            mostRecentLetter.letter = "";
            mostRecentLetter.color = this.Constants.COLOR_RED;
        },

        findNextEmptyAttempt() {
            return this.attempts.find((a) => !this.isAttemptFilled(a));
        },

        debug(text) {
            if (this.Constants.DEBUG) {
                console.log(text);
            }
        },

    },
});