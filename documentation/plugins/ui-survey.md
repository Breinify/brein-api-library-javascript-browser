## UI Survey

### Overview

The UI Survey component provides an interactive, multi-step survey experience rendered inside a popup. Surveys are defined as a directed graph of nodes and edges and are navigated by user answers. The component emits a set of semantic events that allow integrators to track rendering, navigation, and user interaction without coupling to UI details.

### Survey Structure

A survey consists of:

- **Nodes**: Individual steps in the survey flow.
    - `start`: Entry point (not rendered).
    - `question`: A question with selectable answers.
    - `recommendation`: A results or recommendation step.
- **Edges**: Directed connections between nodes, usually associated with an answer.

Only `question` nodes are considered *pages* for paging and step counting.

### Display Settings

These paths are relative to the web experience's `settings.configuration` object passed to the survey plugin.

| Setting | Default | Behavior |
| --- | --- | --- |
| `survey.settings.showRestartOverButton` | `false` | Show **Start over** above every question and recommendation page. |
| `survey.nodes[].data.explanation` | `null` | Show plain-text clarification directly below a question. Missing, null, empty, and whitespace-only values show nothing. |
| `survey.nodes[].data.settings.showSelectedAnswers` | `false` | Show completed answers near the top of this question or recommendation page, below its heading and explanation/subtitle. |

Each page enables its own selected-answer summary; there is no survey-wide inheritance. Only the boolean
`true` enables either display switch. With the defaults, the existing page layout is unchanged.

The summary follows the active navigation path. Each item displays the question above its selected answer
bubble. It excludes the current question and any later or discarded answers, and is hidden when there are no
completed answers. The items are informational and do not navigate or remove answers. Back navigation updates
the summary as later selections are discarded. Labels and explanations are rendered as text, not HTML.

**Start over** keeps the popup open, clears every selected answer and its recommendation attributes, and returns
to the first page with a new session ID. It scrolls to the top and focuses the page heading. The current browser
history entry is replaced; entries from the discarded session cannot restore its answers. Navigating into an
old session entry closes the popup. Restart emits `br-ui-survey:navigated` with `reason: "restart"` and the new
session ID.

### Styling the Display Settings

The default presentation inherits the survey font and uses its existing gray borders, neutral backgrounds,
rounded corners, and button styling. Answer bubbles wrap onto additional rows and long labels wrap within
the popup width. Start over uses the shared `.br-survey-btn` class.

Apply custom CSS through the web experience's `configuration.style.snippet` reference. The stylesheet is
applied inside the popup's shadow root after the default styles; ordinary page CSS does not cross that boundary.

| CSS selector | Element |
| --- | --- |
| `.br-survey-page-actions` | Top row containing Start over |
| `.br-survey-btn--restart` | Start over button |
| `.br-survey-question-explanation` | Clarification below a question |
| `.br-survey-selected-answers` | Summary panel |
| `.br-survey-selected-answers__title` | “Your selections so far” or “Based on your selections” heading |
| `.br-survey-selected-answers__list` | Wrapping list of completed answers |
| `.br-survey-selected-answer` | One question/answer item |
| `.br-survey-selected-answer__question` | Question label above the bubble |
| `.br-survey-selected-answer__answer` | Selected-answer bubble |

Every `.br-survey-selected-answer` item has these attributes for customer styling or DOM integration:

| Attribute | Value |
| --- | --- |
| `data-br-survey-question-id` | Question node ID |
| `data-br-survey-answer-id` | Selected answer's `_id` |
| `data-br-survey-question` | Question text |
| `data-br-survey-answer` | Selected answer's title |

For example, a customer CSS snippet can hide question labels and recolor the bubbles:

```css
.br-survey-selected-answer__question {
    display: none;
}

.br-survey-selected-answer__answer {
    background: #e9f0ff;
    border-color: #cbdcff;
    color: #173b75;
}
```

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
They represent the position within the sequence of rendered question pages and are derived from the active navigation history.

Answer-related events intentionally do **not** include step transition data, as they do not imply navigation.
