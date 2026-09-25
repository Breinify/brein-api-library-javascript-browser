# Build custom survey pages with the context API

Custom pages let you add your own content and interactions to a survey: a welcome screen, an answer review,
a signup form, or a custom final page. You provide the HTML, CSS, and JavaScript; the survey takes care of
showing the page in its popup and moving visitors through the survey.

Your JavaScript receives a `context` object whenever the page is shown. It gives you access to your page's
HTML, earlier answers, saved page state, and navigation controls. You do not need to create this object or
look up the survey yourself.

Start with the working example below, then use the reference sections as you add behavior to your page.
For survey-wide settings and events, see [UI Survey](ui-survey.md). To explore the implementation, see
[UiSurvey.js](../../src/plugins/UiSurvey.js).

## In this guide

- [Let's get started](#lets-get-started)
- [Connect your page to the survey](#connect-your-page-to-the-survey)
- [Context reference](#context-reference)
- [Navigation and validation](#navigation-and-validation)
- [State and mount lifetime](#state-and-mount-lifetime)
- [Asynchronous work and cleanup](#asynchronous-work-and-cleanup)
- [Rendering and styling](#rendering-and-styling)
- [Troubleshooting](#troubleshooting)
- [Before you publish](#before-you-publish)

## Let's get started

Let's build a page that shows visitors their earlier answers and asks them to confirm they have reviewed
them. Continue becomes available when they check the box. If they return from a later page, the box stays
checked. This example needs no external service or additional library.

A custom page has three pieces: HTML for its content, optional CSS for its appearance, and optional
JavaScript for its behavior. We'll create each piece, then connect them to the survey.

### 1. Add the content

The survey fills `data-br-survey-selected-answers` with the visitor's earlier answers. The checkbox is ours
to control. Save this as the page's HTML snippet.

```html
<section aria-labelledby="acknowledgement-title">
    <h2 id="acknowledgement-title">Review your selections</h2>
    <div data-br-survey-selected-answers></div>
    <label class="acknowledgement">
        <input type="checkbox" name="acknowledged">
        I have reviewed my selections.
    </label>
</section>
```

### 2. Style the page

Save this as the page's CSS snippet. It spaces the checkbox and label and keeps keyboard focus visible.
These styles apply to your custom content inside the survey.

```css
.acknowledgement {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-top: 1rem;
}

input:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 3px;
}
```

### 3. Add behavior with `context`

Save this function as the page's JavaScript snippet. The survey calls it after adding your HTML to the page.
This setup function is called the **initializer**.

Here we use three context members: `root` to find the checkbox, `state` to remember its value, and
`setNextEnabled()` to control Continue. The returned `validate()` function checks the page before moving
forward; `destroy()` removes our event listener when the visitor leaves.

```javascript
function (context) {
    const checkbox = context.root.querySelector('[name="acknowledged"]');
    checkbox.checked = context.state.acknowledged === true;

    function syncReadiness() {
        context.state.acknowledged = checkbox.checked;
        context.setNextEnabled(checkbox.checked);
    }

    syncReadiness();
    checkbox.addEventListener("change", syncReadiness);

    return {
        validate: function () {
            return {
                valid: checkbox.checked,
                message: "Please confirm that you reviewed your selections."
            };
        },
        destroy: function () {
            checkbox.removeEventListener("change", syncReadiness);
        }
    };
}
```

The survey supplies the Continue button in its footer, so you do not need to add one to your HTML.
The configuration below gives the standard Next button its "Continue" label.

Try entering the page, checking the box, continuing, and coming back. `context.state` lets the new page
instance restore the checkbox. Going back past this page or starting over clears that saved value.

In this example, an unchecked box disables Continue. If you would prefer to let visitors press Continue
and then show a message, remove the `context.setNextEnabled(checkbox.checked)` call and keep the check in
`validate()`. Validation only runs when advancing is enabled.

## Connect your page to the survey

If your survey setup already provides HTML, CSS, and JavaScript snippet fields for a custom page, put the
three pieces there. If you are building the survey configuration directly, add a node with `type: "custom"`
and connect it to the preceding and following steps.

Here is the node configuration for our example. Replace the snippet IDs with the IDs registered for your
content. `data.html` is required; `data.css` and `data.js` are optional.

```javascript
const customNode = {
    id: "acknowledgement",
    type: "custom",
    data: {
        html: { snippetId: "acknowledgement-html" },
        css: { snippetId: "acknowledgement-css" },
        js: { snippetId: "acknowledgement-js" },
        settings: {
            isTerminal: false,
            showBackButton: true,
            showNextButton: true,
            nextButtonLabel: "Continue"
        }
    }
};
```

Add this node to an existing survey and give it exactly one outgoing connection, with no answer handle,
to the next step. For a final page, set `isTerminal: true`, omit `showNextButton` or set it to `false`, and
leave out the outgoing connection. Final pages cannot advance. Back and Start over still follow the
survey's settings and navigation history.

Each content source uses either `{ snippetId: "registered-id" }` to reference a snippet or `{ snippet: ... }`
to provide its content directly. Choose one per source; there is no `snippetType` field. Direct HTML and CSS
snippets are strings. Direct browser JavaScript snippets must be executable functions.

### How the survey calls your JavaScript

The JavaScript snippet is a **function expression**. This is the reusable shape, with optional validation
and cleanup functions:

```javascript
function (context) {
    // initialize the mounted page here
    return {
        validate: function () {
            return true;
        },
        destroy: function () {
            // clean up resources owned by this mount here
        }
    };
}
```

Script Creator accepts the function expression as a string and compiles it into an executable snippet.
Direct browser configurations must supply an actual function as `js.snippet`, or a registered function
reference through `js.snippetId`. The browser does not evaluate JavaScript strings. Referenced snippets
must be available before mount; missing references fail immediately without a background retry.
Put behavior in the initializer: `<script>` elements in custom HTML are removed.

Each time the survey creates and displays a fresh instance of your page, it **mounts** the page. It inserts
your HTML, applies CSS, fills answer summaries, and then calls the initializer once. Updating a field or
changing the Next button's availability does not call the initializer again.

The initializer can return nothing (`undefined`), an object containing your optional `validate` and `destroy`
functions (the **controller**), or a Promise resolving to either. Omit any hooks you do not need.
Returning `null`, a boolean, or a controller
with non-function hook values is invalid. No particular `this` binding is part of this API; capture `context`
in the initializer's closure.

Next is unavailable until initialization succeeds. It then defaults to enabled unless the initializer called
`context.setNextEnabled(false)`. Omitting JavaScript uses the normal defaults. Initialization failures show
a page error and keep Next unavailable; Back, close, and restart remain available under their normal rules.

## Context reference

The outer `context` object is frozen. Its properties cannot be reassigned. `settings` is frozen and `answers`
is a deeply frozen snapshot. The contents of `state` and your page's DOM are intentionally mutable.

| Member | Type | Purpose |
| --- | --- | --- |
| `root` | `Element \| ShadowRoot` | Query root containing your custom HTML. Currently a nested `ShadowRoot`; query through this member rather than depending on wrappers. Excludes the shared footer and page error area. |
| `webExVersionId` | `string` | Identifier of the web-experience version hosting the survey. |
| `sessionId` | `string` | Identifier of the active survey session. Restart creates a new one. |
| `nodeId` | `string` | Configured ID of this custom node. |
| `settings` | Read-only object | Effective page settings described below; configuration rather than live navigation availability. |
| `answers` | Read-only array | Prior selected question answers on the active path. Includes one entry per selected answer for multi-select questions. |
| `state` | Mutable plain object | Data owned by this node within the survey session. Initially `{}`; subject to the retention rules below. |
| `signal` | `AbortSignal` | Aborted when this mount is disposed. Use for cancellation and checking whether delayed work is still relevant. |
| `setNextEnabled(enabled)` | `(boolean) => void` | Set permission to advance and refresh standard Next availability. A non-boolean argument throws `TypeError` while the context is active. |
| `next()` | `() => Promise<boolean>` | Request the configured forward transition through readiness and validation checks. |
| `back()` | `() => Promise<boolean>` | Request normal Back navigation without forward validation. |
| `skip()` | `() => void` | Queue a direction-aware skip of an intermediate page after initialization succeeds. |

An inactive context's `next()` and `back()` resolve `false`; its `setNextEnabled()` and `skip()` calls do
nothing. These protections do not prevent your own code from modifying an old DOM or state reference.
Check `context.signal.aborted` after asynchronous work before writing either.

### Effective settings

`context.settings` contains exactly these resolved fields:

| Field | Type | Resolution for custom pages |
| --- | --- | --- |
| `isTerminal` | `boolean` | `true` only when explicitly configured; otherwise `false`. |
| `showBackButton` | `boolean` | Defaults to `true`. Actual Back visibility also requires history. |
| `showNextButton` | `boolean` | Defaults to `true` for intermediate pages; always `false` for terminal pages. |
| `showRestartOverButton` | `boolean` | Page boolean, then survey-wide setting, then `false`. |
| `backButtonLabel` | `string` | Nonblank page label, then nonblank survey-wide label, then `"Back"`. |
| `nextButtonLabel` | `string` | Nonblank page label, then nonblank survey-wide label, then `"Next"`. |
| `restartButtonLabel` | `string` | Nonblank page label, then nonblank survey-wide label, then `"Start over"`. |

Missing/null inheritable settings use their inherited values. Blank labels also inherit. Setting
`showNextButton: true` on a terminal page is invalid configuration. `showSelectedAnswers` is not a context
setting; custom pages place summaries with an HTML placeholder.

Do not use `showNextButton` as a readiness flag: it does not change when initialization, validation, or
`setNextEnabled(false)` disables advancing. Hiding a standard Back or Next button does not disable the
corresponding context method.

### Reading prior answers

Each entry in `context.answers` has this shape:

```json
{
    "questionId": "occasion",
    "questionLabel": "What are you planning?",
    "answerId": "family-dinner",
    "answerLabel": "A family dinner",
    "values": [{ "key": "occasion", "value": "family" }]
}
```

Question groups follow navigation order. `values` preserves the selected answer's configured attribute
entries, or is `[]` when none are present. Missing question/answer labels become empty strings. Custom-page
state and discarded branches are excluded. This is a snapshot for the current mount, not a live answer store.
Mutating it cannot change survey selections and may throw because it is frozen.

Match stable IDs when implementing behavior; labels may change or be translated. Use `filter()` when the
question can have multiple selected answers:

```javascript
const occasionAnswers = context.answers.filter(function (answer) {
    return answer.questionId === "occasion";
});
const isFamilyDinner = occasionAnswers.some(function (answer) {
    return answer.answerId === "family-dinner";
});
```

Use `textContent` when displaying answer labels or other user-provided text. There are no context methods
for changing question answers or adding recommendation attributes. Writing `context.state` does not submit
data to a backend, add analytics fields, or alter recommendation inputs automatically.

## Navigation and validation

### `setNextEnabled(enabled)`

Use this to express readiness, such as a completed form or a successful external submission. It affects
both the standard Next button and `context.next()`. It does not show a hidden button, bypass initialization,
create an outgoing edge, or allow a terminal page to advance. Pass a boolean, not a truthy value such as `1`.

### `next()` and `validate()`

The standard Next button and `context.next()` use the same sequence:

1. Require an active, initialized, enabled, nonterminal page with an outgoing edge and no conflicting navigation.
2. Mark forward navigation pending, disable standard Next, and clear the previous page error.
3. Invoke `validate()` if present; await its result if it returns a Promise.
4. Recheck that this mount is still active and advancing is still enabled.
5. If valid, follow the configured edge once, preserving normal history and navigation events.

`next()` resolves `true` when the transition succeeds; otherwise it resolves `false`, including when disabled,
invalid, already pending, or cancelled. It takes no target ID and cannot jump to an arbitrary page. A successful
transition does not imply that the destination page's asynchronous initialization has finished.
Do not call `next()` from inside `validate()`; return the validation result and let the runtime navigate.

`validate()` takes no arguments and returns one of these values directly or through a Promise:

| Return value | Result |
| --- | --- |
| `true` or `{ valid: true }` | Allow navigation. |
| `false` | Stay on this page and display the default validation message. |
| `{ valid: false, message: "Please complete this page." }` | Stay and display the message as plain text. |

`message` is optional and may be `null`; empty or whitespace-only messages use the default. An absent hook
permits navigation. A configured hook returning `undefined`, `null`, a string, or an invalid object fails
validation. Exceptions and rejected Promises also block navigation and display a generic error.

Duplicate forward requests are ignored while validation is pending. Back, close, and restart do not wait for
validation; leaving aborts the old context and invalidates its pending result. Browser Forward also goes
through forward checks and cannot jump over multiple pages to bypass validation.

A custom button can request navigation when `showNextButton` is false:

```javascript
// inside the initializer, with a <button type="button" data-continue> in your HTML
const continueButton = context.root.querySelector("[data-continue]");
async function onContinue() {
    continueButton.disabled = true;
    try {
        await context.next();
    } finally {
        if (!context.signal.aborted) {
            continueButton.disabled = false;
        }
    }
}
continueButton.addEventListener("click", onContinue);
// remove this listener in the controller's destroy() hook
```

The runtime updates its own footer, not custom buttons. Manage your custom buttons' disabled/busy states
yourself. Do not navigate during initialization with `next()`: the page is not ready yet. Use `skip()` if
the whole page is unnecessary.

### `back()`

`back()` requests the previous survey step through normal browser-history handling. It resolves `true` on
a successful transition, otherwise `false`, including when there is no prior survey page, a Back request is
already pending, or the context is inactive. It does not run `validate()` and is not blocked by
`setNextEnabled(false)`. Hiding standard Back does not prevent a custom control from calling this method.

### `skip()`

Use `skip()` for an intermediate page that does not apply. For example, skip a follow-up when a known prior
answer makes it unnecessary:

```javascript
function (context) {
    const doesNotApply = context.answers.some(function (answer) {
        return answer.questionId === "contact-preference" && answer.answerId === "no-contact";
    });
    if (doesNotApply) {
        context.skip();
        return;
    }
    // initialize the applicable page here
}
```

The request waits for successful initialization and the current history transition to finish. On forward
entry it follows the sole outgoing edge; on Back entry it continues backward. Direct opening or reopening
uses the forward direction. Consecutive skipped pages continue in the same direction while retaining normal
history entries and navigation events. Authors do not need timers or state markers to determine direction.

`skip()` intentionally bypasses readiness set with `setNextEnabled(false)` and the `validate()` hook. It
returns `undefined`, not a Promise or success flag. Terminal pages, inactive contexts, duplicate pending
requests, and requests during forward validation are ignored. Leaving cancels queued work. Initialization
failure prevents skipping; navigation failure displays a page error.

## State and mount lifetime

A mount is one rendered instance of a page. First entry, return via Back, reopening, and content replacement
create fresh mounts and fresh context objects. Field changes, footer refreshes, and `setNextEnabled()` do not
remount content or rerun the initializer.

| Action | Effect on page state |
| --- | --- |
| First visit to a custom node | Supplies an empty `{}`. |
| Move forward from the page | Retains its state for a later return. |
| Return from a later page to this page | Supplies retained state to a new initializer; rebuild the DOM from it. |
| Navigate back past this page to an earlier step | Discards this page's state together with downstream state/answers. |
| Start over | Clears all page state and starts a new session. |
| Close with `popup.resetOnClose: true` (default) | Clears state and the session. |
| Close with `popup.resetOnClose: false` | Retains state; reopening still creates a new mount and context. |

Mutate fields (`context.state.email = value`); do not replace `context.state`, since that property is frozen.
Keep JSON-compatible data: strings, numbers, booleans, nulls, arrays, and plain objects. Keep DOM references,
timers, functions, controllers, and Promises in the initializer's closure instead. State is runtime memory,
not durable storage across reloads or a store shared between custom nodes.

Every disposal aborts `context.signal` before invoking `destroy()`. A supplied `destroy()` runs once for that
mount and takes no arguments. Cleanup is synchronous: the runtime does not await a Promise returned by it.
Cleanup errors are logged without blocking the rest of navigation. If an asynchronous initializer returns
a controller after its mount was disposed, the runtime invokes that controller's `destroy()` rather than
activating it. If initialization throws or rejects before returning a controller, it must clean up resources
it already created itself; there is no returned controller for the runtime to destroy.

## Asynchronous work and cleanup

Pass `context.signal` to cancellable requests and check `signal.aborted` before updating DOM or state after
each asynchronous operation. A cancelled request can still have completed an external action; cancellation
does not undo a subscription, registration, or other server-side change.

This initializer loads optional helper text from a customer-provided URL. Pair it with
`<p data-help role="status" aria-live="polite"></p>` in your HTML. Replace the example path with your actual
service; the context provides no HTTP, subscription, or persistence service.

```javascript
function (context) {
    const help = context.root.querySelector("[data-help]");
    let disposed = false;

    async function loadHelp() {
        help.textContent = "Loading details...";
        try {
            const response = await fetch("/your-service/survey-help", {
                signal: context.signal
            });
            if (context.signal.aborted || disposed) {
                return;
            }
            if (!response.ok) {
                throw new Error("Unable to load help.");
            }
            const text = await response.text();
            if (context.signal.aborted || disposed) {
                return;
            }
            help.textContent = text;
        } catch (error) {
            if (!context.signal.aborted && !disposed) {
                help.textContent = "Details are unavailable. You can still continue.";
            }
        }
    }

    loadHelp();
    return {
        destroy: function () {
            disposed = true;
        }
    };
}
```

This example returns its controller immediately, so optional loading does not block Next. For required work,
either return a Promise from the initializer or explicitly disable Next until the work succeeds. Handle
recoverable failures in your UI, including a retry action where appropriate. Release external event listeners,
timers, observers, and subscriptions in `destroy()`, and use an abort listener if cleanup must be possible
before an asynchronous initializer returns its controller.

Perform external submissions in a deliberate form or button handler and prevent duplicate submissions.
Keep `validate()` focused on checking whether navigation may proceed: users can request Next more than once.
If an integration uses session/node IDs for correlation, remember that a single session can mount the same
node repeatedly; those IDs alone do not distinguish individual submissions.

## Rendering and styling

Always query your page through `context.root`. `document.querySelector()` does not reach through the nested
shadow root. Do not depend on the root's host, ancestors, runtime private fields, or shared footer markup.

Custom CSS applies inside this root. Font and CSS custom properties inherit from the survey, but ordinary
document selectors do not cross the shadow boundary. Your CSS cannot select the shared footer or runtime
error area from inside the custom root. Inline CSS is stylesheet text; referenced CSS can also use Script
Creator's `<style>` wrapper. Shadow DOM scopes styles; it is not a security boundary for JavaScript.

Place the standard answer summary wherever it fits your page:

```html
<div data-br-survey-selected-answers></div>
```

The runtime fills every matching placeholder before initialization and hides empty placeholders. It does
not insert a summary without one. Default summary styles are included before your custom CSS, so your CSS
can override them. The [summary classes and data attributes](ui-survey.md#styling-the-display-settings) remain
available. Preserve the runtime-generated contents unless you intentionally supply another presentation.

Use semantic headings, explicit form labels, keyboard-operable buttons, visible focus styles, and live
status text for asynchronous operations. Use `type="button"` for navigation buttons inside forms; use a
submit handler with `preventDefault()` when the form performs its own action.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Next never becomes available | Pending/rejected initialization, `setNextEnabled(false)`, terminal settings, missing outgoing edge, or incompatible/missing snippets. |
| `next()` returns `false` | Readiness, validation result, pending navigation, and `signal.aborted`. Calling it inside the initializer is too early. |
| Validation never runs | A disabled page cannot request forward validation; enable Next if clicking it should show a validation message. |
| DOM lookup returns `null` | Query `context.root` and verify the selector matches your HTML snippet. |
| Values disappear after Back | Returning to the page retains its state; going back past it discards its state. Restore form fields in each initializer. |
| Handlers or requests run twice | Register once per mount, clean up in `destroy()`, and guard submission handlers while a request is pending. |
| Custom CSS cannot style Next | Standard footer controls live outside the custom root; use survey-level styling. |
| `skip()` does not advance | It has no return value, waits for successful initialization, and does nothing on terminal/inactive pages or during validation. Back entry skips backward. |

The runtime displays plain-text errors in its shared page error area with `role="alert"`:

| Failure | Message |
| --- | --- |
| Initialization/source/controller failure | `This page could not be loaded. Please try again.` |
| Validation exception, rejection, or invalid return value | `This page could not be validated. Please try again.` |
| Invalid result without a nonblank custom message | `Please complete this page to continue.` |
| Failed skip navigation | `This page could not be skipped. Please try again.` |

Exception details are logged to the console rather than shown to visitors. Reentering or reopening retries
initialization. Validation errors clear before the next accepted validation attempt or when leaving the page.
The context has no general `showError()` method; render non-validation status/error messages in your own HTML.

## Before you publish

Use this checklist to review your page, whether you wrote it yourself or used an AI assistant.

- Deliver matching HTML, optional CSS, and a `function (context) { ... }` initializer; specify any required node settings.
- Use only the context members documented here. There is no `goTo`, `submit`, `close`, `restart`, `setState`,
  `setAnswers`, `canGoNext`, or `onMount` context API, and no exposed mutable history or runtime object.
- Query within `context.root`; keep behavior out of HTML script tags and styles scoped to your page.
- Treat settings and answers as read-only. Match answers by IDs and support multiple entries per question.
- Save restorable data in `context.state`; restore it on every mount and keep resources in the closure.
- Decide separately when advancing is enabled and what the final validation check should enforce.
- Use `next()` for validated forward navigation and `skip()` only when the entire page does not apply.
- Handle inactive contexts after every asynchronous boundary and release mount-owned resources in `destroy()`.
- Identify customer-provided services/helpers explicitly; do not imply they are supplied by the survey API.
- Review first entry, return from a later page, Back past the page, close/reopen, restart, duplicate clicks,
  validation failure, and leaving while an asynchronous operation is pending.
