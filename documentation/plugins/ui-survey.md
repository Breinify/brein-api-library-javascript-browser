## UI Survey

### Overview

The UI Survey component provides an interactive, multi-step survey experience rendered inside a popup. Surveys are defined as a directed graph of nodes and edges and are navigated by user answers. The component emits a set of semantic events that allow integrators to track rendering, navigation, and user interaction without coupling to UI details.

### Survey Structure

A survey consists of:

- **Nodes**: Individual steps in the survey flow.
    - `start`: Entry point (not rendered).
    - `question`: A question with selectable answers.
    - `recommendation`: A results or recommendation step.
    - `custom`: HTML content with optional scoped CSS and a JavaScript page controller; intermediate or terminal.
- **Edges**: Directed connections between nodes, usually associated with an answer.

Only `question` nodes are considered *pages* for paging and step counting.

### Display Settings

These paths are relative to the web experience's `settings.configuration` object passed to the survey plugin.

| Setting | Default | Behavior |
| --- | --- | --- |
| `survey.settings.showRestartOverButton` | `false` | Default **Start over** visibility for all visible pages. |
| `survey.nodes[].data.settings.showRestartOverButton` | `null` (inherit) | Override Start over visibility for this page. Explicit `true` shows it, explicit `false` hides it, and missing/null inherits the survey default. |
| `survey.nodes[].data.explanation` | `null` | Show plain-text clarification directly below a question. Missing, null, empty, and whitespace-only values show nothing. |
| `survey.nodes[].data.settings.showSelectedAnswers` | `false` | Show completed answers near the top of this question or recommendation page, below its heading and explanation/subtitle. |
| `survey.settings.backButtonLabel` | `"Back"` | Default label for the Back button. |
| `survey.nodes[].data.settings.backButtonLabel` | `null` (inherit) | Override this button label on the page. |
| `survey.settings.nextButtonLabel` | `"Next"` | Default label for the Next button. |
| `survey.nodes[].data.settings.nextButtonLabel` | `null` (inherit) | Override this button label on the page. |
| `survey.settings.restartButtonLabel` | `"Start over"` | Default label for the Start over button. |
| `survey.nodes[].data.settings.restartButtonLabel` | `null` (inherit) | Override this button label on the page. |

Button labels resolve independently: nonblank page label, then nonblank General label, then the built-in
wording ("Back", "Next", "Start over"). Missing, null, empty, and whitespace-only page labels inherit;
the same General values use the built-in wording. Nonblank text is preserved and rendered as plain text,
not HTML. Labels do not enable buttons or change navigation: Back still requires history, Next still requires
a selected answer on questions. Custom pages apply their readiness and validation hooks. Start over follows its visibility setting.

The editor should use optional text inputs at both levels and show inherited wording as a placeholder on pages.
Do not save the placeholder as a page override. Clearing a page label restores inheritance. General labels
serialize with their defaults; unset page labels remain null and are omitted from normalized JSON.

Each page enables its own selected-answer summary; that setting has no survey-wide inheritance.
Start over resolves the page's explicit boolean first, then the survey default, then `false`.
Missing/null page settings preserve inheritance; changing the survey default affects only inheriting pages.


The summary follows the active navigation path. Each selection occupies a compact row with the question on
the left and its answer badge on the right. On narrow screens or in narrow containers, the answer appears
directly below the question. Questions and answers share the same text size and consistent row spacing. It excludes the current question and any later or discarded answers, and is hidden when there are no
completed answers. The items are informational and do not navigate or remove answers. Back navigation updates
the summary as later selections are discarded. Labels and explanations are rendered as text, not HTML.

Footer actions appear left to right as **Back | Start over | Next**, omitting hidden or unavailable controls.
The primary action is the rightmost visible button: **Next**, otherwise **Start over**, otherwise **Back**.
On an endpoint, Next is absent, so Start over is primary with Back to its left. If Start over is hidden,
Back is primary. A visible but disabled Next remains primary while waiting for an answer, initialization,
or validation; its disabled state does not promote another button. Restart and label inheritance remain unchanged.

**Start over** appears in the shared footer. It keeps the popup open, clears every selected answer and its recommendation attributes, and returns
to the first page with a new session ID. It scrolls to the top and focuses the page heading. The current browser
history entry is replaced; entries from the discarded session cannot restore its answers. Navigating into an
old session entry closes the popup. Restart emits `br-ui-survey:navigated` with `reason: "restart"` and the new
session ID.

### Styling the Display Settings

The default presentation inherits the survey font and uses its existing gray borders, neutral backgrounds,
rounded corners, and button styling. Summary rows use subtle separators; long questions and answers wrap
within the available width. Start over uses the shared `.br-survey-btn` class.

Apply custom CSS through the web experience's `configuration.style.snippet` reference. The stylesheet is
applied inside the popup's shadow root after the default styles; ordinary page CSS does not cross that boundary.

| CSS selector | Element |
| --- | --- |
| `.br-survey-footer-controls` | Footer containing Back, Start over, and Next |
| `.br-survey-btn--primary` | Primary visible action, selected by Next → Start over → Back priority |
| `.br-survey-btn--restart` | Start over button |
| `.br-survey-question-explanation` | Clarification below a question |
| `.br-survey-selected-answers` | Summary panel |
| `.br-survey-selected-answers__title` | Empty title hook; customer CSS can add content with `::before` or `::after` |
| `.br-survey-selected-answers__list` | Compact list of evenly spaced question/answer rows |
| `.br-survey-selected-answer` | One question/answer item |
| `.br-survey-selected-answer__question` | Question label beside the answer, above it on narrow layouts |
| `.br-survey-selected-answer__answer` | Selected-answer bubble |

Every `.br-survey-selected-answer` item has these attributes for customer styling or DOM integration:

| Attribute | Value |
| --- | --- |
| `data-br-survey-question-id` | Question node ID |
| `data-br-survey-answer-id` | Selected answer's `_id` |
| `data-br-survey-question` | Question text |
| `data-br-survey-answer` | Selected answer's title |

The title is empty and takes no space by default; it is not hidden, so pseudo-elements can supply a visible
heading. The summary keeps an accessible “Selected answers” label independently of the empty title.
For example, customer CSS can add a title and recolor the answer badges:

```css
.br-survey-selected-answers__title::before {
    content: "Your selections";
    display: block;
    margin-bottom: 0.6em;
}

.br-survey-selected-answer__answer {
    background: #e9f0ff;
    border-color: #cbdcff;
    color: #173b75;
}
```

### Custom Pages and Page Lifecycle

Question, recommendation, and custom pages use a common controller lifecycle. Content mounts once per entry;
footer updates do not remount it. Leaving, closing, or restarting disposes the current mount. Recommendation
callbacks from an inactive mount cannot update the current page.

A custom node has `type: "custom"`, required `data.html`, and optional `data.css` / `data.js`. Each source uses
`{snippet: ...}` or `{snippetId: ...}`; there is no `snippetType`. HTML and CSS resolve to strings. JavaScript
resolves to `function (context) { ... }`; Script Creator compiles inline strings into executable functions in
`module.webExperienceSnippets`. Direct `uiSurvey.render` callers must supply an executable function or a
registered reference, since this plugin never evaluates JavaScript strings.

Custom settings under `data.settings`:

| Setting | Missing/null default | Behavior |
| --- | --- | --- |
| `isTerminal` | `false` | Terminal pages cannot advance and have no outgoing edge; intermediate pages have exactly one unconditional edge. |
| `showBackButton` | `true` | Standard Back is shown when history exists. |
| `showNextButton` | Intermediate: true; terminal: false | Hiding Next still permits `context.next()`. Terminal pages cannot show Next or advance. |
| Restart and labels | Inherit General | Same overrides as other pages. |

Custom HTML lives in a nested shadow root within `.br-popup-body`. Its CSS styles this content, including
summary placeholders, while shared controls retain normal survey styling. CSS variables and fonts inherit.
Global CSS snippets with Script Creator's `<style>` wrapper are supported. HTML script elements are removed.
Place `<div data-br-survey-selected-answers></div>` wherever a summary belongs; each placeholder is filled
before initialization and hidden when empty. `showSelectedAnswers` does not affect custom placeholders.

The initializer runs once per mount with a frozen `context`: `root`, `webExVersionId`, `sessionId`, `nodeId`,
resolved `settings`, a deeply frozen `answers` snapshot, mutable per-page `state`, `signal`,
`setNextEnabled(boolean)`, `next(): Promise<boolean>`, and `back(): Promise<boolean>`.
It can return nothing, `{validate, destroy}`, or a Promise resolving to either. Next is disabled while
initialization is pending. Missing optional JavaScript enables Next by default; a configured missing or
incompatible source fails immediately and keeps Next disabled. References must be registered before mount.

An optional `validate()` hook returns a boolean or `{valid: boolean, message?: string | null}`, directly or
through a Promise. Invalid results, errors, and rejections block navigation. Duplicate Next requests are
ignored while validation is pending. Standard Next, double-tap on questions, `context.next()`, and browser
Forward share navigation handling. Browser Forward cannot skip multiple pages or bypass custom validation.
Back, close, and restart abort the old signal and invalidate pending results; `destroy()` runs once per mount.
State survives a return from later pages, is discarded when navigating back past its page, and clears on restart.
Close follows `popup.resetOnClose`; reopening creates a fresh context even when state is retained.

The full [configuration and snippet-author contract](https://github.com/Breinify/brein-external/blob/master/brein-external-script-creator/docs/survey-custom-pages.md)
includes all context types, failure messages, state rules, metadata, and a newsletter example.

### Popup Lifecycle

The survey is displayed inside a singleton popup element attached to `<body>`.  
Opening the survey creates or reuses the popup, renders the current page, and locks page scrolling. Closing the popup optionally resets the survey state, depending on configuration.

The popup dispatches its own close event, which is forwarded with survey context.

### Event Model

The survey dispatches CustomEvents from the survey element (`<br-ui-survey>`) unless otherwise noted. All events bubble.

Common fields automatically included in all survey events:

- `webExId`: Web Experience ID
- `sessionId`: Survey session identifier

### Events

#### Events Overview

#### Common Event Attributes

The following attributes are included in the `detail` object of **all survey events**, unless stated otherwise.


#### Navigation Event Attributes (`br-ui-survey:navigated`)

The following attributes are **specific to the `br-ui-survey:navigated` event** and describe the semantic transition between two survey steps from the user's perspective.

| **Attribute** | **Type** | **Description** |
|----------|------|-------------|
| `webExId` | `string` | Web Experience identifier of the survey instance |
| `sessionId` | `string \| null` | Identifier of the active survey session |
| `nodeId` | `string \| null` | Identifier of the survey node (page) associated with the event |
| `pageType` | `string \| null` | Type of the current page (e.g. `question`, `recommendation`) |
| `pageIndex` | `number` | Zero-based index of the page within all survey question pages |
| `fromNodeId` | `string \| null` | Identifier of the node the user navigated from |
| `fromPageType` | `string \| null` | Page type of the previous step (e.g. `question`) |
| `fromPageIndex` | `number` | Zero-based index of the previous page |
| `toNodeId` | `string` | Identifier of the node the user navigated to |
| `toPageType` | `string` | Page type of the new step (e.g. `question`, `recommendation`) |
| `toPageIndex` | `number` | Zero-based index of the destination page |
| `totalPages` | `number` | Total number of configured survey question pages |
| `fromStepNumber` | `number \| null` | User-visible step number before navigation (1-based) |
| `toStepNumber` | `number \| null` | User-visible step number after navigation (1-based) |
| `canGoBack` | `boolean` | Indicates whether backward navigation is currently possible |
| `isFirstStep` | `boolean` | Indicates whether the destination step is the first step |
| `isFinalStep` | `boolean` | Indicates whether the destination step is considered final |
| `reason` | `string` | Reason for navigation: `forward`, `back`, `restart`, `history`, or `unspecified` |


| Event |
|-------|
| **`br-ui-survey:rendered`** |
| *When it fires:* After the survey trigger element is rendered into the DOM<br>*Purpose:* Indicates that the survey component is initialized and ready |
| **`br-ui-survey:opened`** |
| *When it fires:* When the popup opens and the first page becomes visible<br>*Purpose:* Marks the start of a user survey session |
| **`br-ui-survey:navigated`** |
| *When it fires:* Whenever the user moves between survey steps (forward, back, restart, or via browser history)<br>*Purpose:* Describes how the user progresses through the survey flow |
| **`br-ui-survey:answer-clicked`** |
| *When it fires:* When a user clicks an answer option without navigating yet<br>*Purpose:* Captures user interaction intent prior to committing a choice |
| **`br-ui-survey:answer-selected`** |
| *When it fires:* When an answer is committed and used to move forward<br>*Purpose:* Records the selected answer that drives navigation |
| **`br-ui-survey:popup-closed`** |
| *When it fires:* When the survey popup is closed for any reason<br>*Purpose:* Signals survey interruption or completion |


#### Overview

Below is a quick overview of the events emitted by the UI Survey. Each event is described briefly here (no field-by-field breakdown), followed by the detailed sections below.

**`br-ui-survey:rendered`**

Emitted after the survey element has rendered its trigger banner into the DOM (i.e., the component is ready and visible on the page).

**`br-ui-survey:opened`**

Emitted when the popup opens and the first survey page is shown.

**`br-ui-survey:navigated`**

Emitted whenever the active survey page changes due to navigation (forward, back, restart, or browser history navigation). This is the event that carries navigation semantics such as step numbers and whether the user can go back.

**`br-ui-survey:answer-clicked`**

Emitted when a user clicks an answer option on a question page (selection changes), without implying navigation. This is useful if you want to react immediately to selection changes while the user is still on the same page.

**`br-ui-survey:answer-selected`**

Emitted when an answer is *confirmed* for the current question as part of proceeding (i.e., when moving forward via the Next action). This event focuses on the answer/question context rather than the navigation context.

**`br-ui-survey:popup-closed`**

Emitted when the popup closes (e.g., close button, backdrop click, or history-driven close). The close reason is always included; additional metadata may be included when provided by the caller.
#### `br-ui-survey:rendered`

Fired once after the survey trigger banner has been rendered into the DOM.

**Detail**
- `webExId`
- `sessionId`

#### `br-ui-survey:opened`

Fired when the popup is opened and the first page is visible.

**Detail**
- `nodeId`
- `pageType`
- `pageIndex`
- `totalPages`
- `webExId`
- `sessionId`

#### `br-ui-survey:navigated`

Fired whenever the active page changes due to navigation (Next, Back, Start over, browser history).

**Detail**
- `fromNodeId`
- `fromPageType`
- `fromPageIndex`
- `toNodeId`
- `toPageType`
- `toPageIndex`
- `totalPages`
- `fromStepNumber`
- `toStepNumber`
- `canGoBack`
- `isFirstStep`
- `isFinalStep`
- `reason` (`forward`, `back`, `restart`, `history`, or `unspecified`)
- `webExId`
- `sessionId`

#### `br-ui-survey:answer-clicked`

Fired when an answer is clicked (selection intent only, no navigation implied).

**Detail**
- `nodeId`
- `pageType`
- `pageIndex`
- `totalPages`
- `questionLabel`
- `answerId`
- `answerLabel`
- `answer`
- `webExId`
- `sessionId`

#### `br-ui-survey:answer-selected`

Fired when an answer is committed as the chosen answer for a question.  
This event is semantic to answering, not navigation.

**Detail**
- `nodeId`
- `pageType`
- `pageIndex`
- `totalPages`
- `questionLabel`
- `answerId`
- `answerLabel`
- `answer`
- `webExId`
- `sessionId`

#### `br-ui-survey:popup-closed` *(dispatched by popup element)*

Fired when the popup closes for any reason.

**Detail**
- `reason` (e.g. `close-button`, `backdrop`, `history`, `unspecified`)
- `webExId`
- `sessionId`

### Step Numbers

Step numbers (`fromStepNumber`, `toStepNumber`) are only emitted with navigation events.  
They represent the position within the sequence of rendered pages and are derived from the active navigation history.

Answer-related events intentionally do **not** include step transition data, as they do not imply navigation.
