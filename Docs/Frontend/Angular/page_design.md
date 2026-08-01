# Design Guide — Argyon

This guide describes the app's visual design system. Any AI or developer creating or styling components **must read and follow this guide** to ensure visual consistency across the whole interface.

---

## 1. Theme system

The app supports two themes: **dark** (default) and **light**. The theme is controlled by the `data-theme` attribute on the root element (`<html>` or `<body>`):

```html
<html data-theme="dark">   <!-- dark (default) -->
<html data-theme="light">  <!-- light -->
```

All color values are **CSS custom properties** defined in `styles.css`. **Hardcoded color values must never be used**; always use the corresponding CSS variables. The concrete values of the variables may change; what stays stable is their semantic meaning and how they're applied.

---

## 2. CSS variables: meaning and usage

### 2.1 Backgrounds (background layers)

Backgrounds form an **elevation hierarchy**: `base → surface → elevated → overlay → subtle`. Each level communicates a different depth layer: `base` is farthest away and `subtle` is closest to the user.

| Variable         | When to use it                                                                 |
|------------------|-------------------------------------------------------------------------------|
| `--bg-base`      | Background of the whole page. The deepest level, never used on elements. |
| `--bg-surface`   | Cards, panels, and main surfaces that float above the base background.   |
| `--bg-elevated`  | Inputs, dropdowns, and any element that elevates above a surface.     |
| `--bg-overlay`   | `:focus` state of inputs and textareas; elements that temporarily overlay content, like tooltips. |
| `--bg-subtle`    | Hover on list rows, very faint separators, low-contrast zones.     |

### 2.2 Brand colors (primary, secondary, accent)

Each brand color has three variants: `light`, base, and `dark`.

| Group       | Base variable          | When to use it                                                               |
|-------------|------------------------|-----------------------------------------------------------------------------|
| primary     | `--color-primary`      | The screen's main action: submit button, active link, focus border. |
| secondary   | `--color-secondary`    | Secondary or neutral actions; elements with lower visual hierarchy.        |
| accent      | `--color-accent`       | Decorative or alternative accents to primary; badges, highlighted icons.  |

The **`-light`** variant is used exclusively for focus rings and low-opacity highlights.
The **`-dark`** variant is used on hover and active states of buttons/controls.

### 2.3 Semantic colors

Semantic colors communicate the meaning of an action or state. Like brand colors, each has `light`, base, and `dark` variants following the same usage pattern.

| Severity   | Base variable         | When to use it                                                               |
|------------|----------------------|-----------------------------------------------------------------------------|
| success    | `--color-success`    | Confirmations, successful saves, correct validation.                     |
| warning    | `--color-warning`    | Warnings, actions the user should review before continuing.      |
| error      | `--color-error`      | Validation errors, irreversible destructive actions.                 |
| info       | `--color-info`       | Informational messages, contextual help.                                    |
| danger     | `--color-danger`     | Risky actions that aren't necessarily an error (e.g. delete with confirmation). |

### 2.4 Semantic backgrounds

These are very-low-opacity versions of each semantic color. Used as a **tint background** on elements that need to communicate a state without being intrusive, such as the background of an invalid input or an alert banner.

| Variable       | When to use it                                                                 |
|----------------|-------------------------------------------------------------------------------|
| `--bg-success` | Soft background on banners, inputs, or areas indicating success.                    |
| `--bg-warning` | Soft background on warnings.                                                 |
| `--bg-error`   | Soft background on inputs with validation errors and error messages.           |
| `--bg-info`    | Soft background on informational panels.                                    |
| `--bg-danger`  | Soft background on dangerous action zones.                                    |

### 2.5 Text

Text has emphasis scales. The right level should be chosen based on the importance of the information.

| Variable           | When to use it                                                                |
|--------------------|------------------------------------------------------------------------------|
| `--text-primary`   | All main content text: labels, values, titles.             |
| `--text-secondary` | Supporting text, subtitles, auxiliary descriptions.                     |
| `--text-tertiary`  | Input placeholders and very low-emphasis text.                         |
| `--text-disabled`  | Text of fully inactive or unavailable elements.                |
| `--text-inverse`   | Text placed **over a colored background** (e.g. the label inside a colored button). Ensures legibility over chromatic backgrounds. |

### 2.6 Borders

Borders use variable opacities to adapt to both themes. They have three intensity levels:

| Variable           | When to use it                                                                |
|--------------------|------------------------------------------------------------------------------|
| `--border-subtle`  | Nearly imperceptible separators, dividers between related sections.    |
| `--border-default` | Standard border for inputs, cards, and interactive containers.             |
| `--border-strong`  | Emphasized border to clearly separate distinct sections.           |

**Semantic borders** (`--border-success`, `--border-error`, etc.) are used as the `box-shadow` color of the focus ring when the input is in a validation state. For example, an invalid input in focus uses `--border-error` in its box-shadow.

### 2.7 Shadows

| Variable      | When to use it                                                        |
|---------------|------------------------------------------------------------------------|
| `--shadow-sm` | Cards and elements with light elevation.                            |
| `--shadow-md` | Dropdowns, popovers, mid-level floating elements.            |
| `--shadow-lg` | Modals and high-level overlays.                                   |

### 2.8 Border radius

| Variable       | When to use it                                     |
|----------------|---------------------------------------------------|
| `--radius-sm`  | Badges, chips, tags, and very small elements.    |
| `--radius-md`  | Inputs, buttons, cards — the vast majority of components. |
| `--radius-lg`  | Modals, drawers, and large panels.       |

---

## 3. Typography

- **Font family**: system font stack (`system-ui`, `Segoe UI`, `Roboto`, etc.), applied globally in `styles.css`. Not declared per component; inherited automatically.
- **Base size for form components**: `14px`.
- **Weight for buttons and labels**: `font-weight: 500`.
- The default text color is `var(--text-primary)` and is inherited globally. Only overridden when a different emphasis level is needed.

---

## 4. Interaction patterns

### 4.1 Transitions

All interactive elements apply smooth **0.2s** transitions on the properties that change state:

```css
transition: background-color 0.2s, box-shadow 0.2s, border-color 0.2s;
```

### 4.2 Focus ring (accessibility)

The native `outline` is **always removed** and replaced with a **3px** expanding `box-shadow`. This ensures visual consistency across browsers and respects the color system.

- **On inputs and selects**: `:focus` is used. The ring uses `--color-primary` as the border and a semi-transparent version of primary for the glow.
- **On buttons**: `:focus-visible` (not `:focus`) is used so the ring only appears with keyboard navigation, not mouse clicks. The ring color is the button severity's `-light` variant.

```css
/* Inputs/selects */
&:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px <semi-transparent primary>;
    background-color: var(--bg-overlay);
}

/* Buttons */
&:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-<severity>-light);
}
```

### 4.3 Disabled state

Applied the same way to all controls: reduced opacity without changing colors, and a blocked cursor.

```css
&:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
```

### 4.4 Read-only state

Only applies to inputs and textareas. A more muted background layer is used to communicate that the value exists but isn't editable.

```css
&:read-only {
    background-color: var(--bg-surface);  /* steps back one elevation level */
    border-color: var(--border-subtle);   /* nearly invisible border */
    color: var(--text-secondary);         /* lower-emphasis text */
    cursor: default;

    &:focus {
        /* no visual change on focus: the field isn't interactive */
        border-color: var(--border-subtle);
        box-shadow: none;
        background-color: var(--bg-surface);
    }
}
```

### 4.5 Validation error state (Angular Reactive Forms)

Triggered by the `.ng-invalid.ng-touched` classes that Angular adds automatically.

```css
&.ng-invalid.ng-touched {
    border-color: var(--color-error);
    background-color: var(--bg-error);  /* soft tint of the error color */

    &:focus {
        border-color: var(--color-error);
        box-shadow: 0 0 0 3px var(--border-error);  /* ring in error color */
        background-color: var(--bg-error);
    }
}
```

### 4.6 Hover and active states on buttons

The hover effect darkens the color using the `-dark` variant. Active adds an inward shadow to simulate physical pressure.

```css
&:not(:disabled):hover {
    background-color: var(--color-<severity>-dark);
}
&:not(:disabled):active {
    background-color: var(--color-<severity>-dark);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}
```

---

## 5. Existing components

### 5.1 Button (`<component-button>`)

**Inputs:**
- `label: string` — button text
- `type: string` — HTML type (`"button"`, `"submit"`, `"reset"`); defaults to `"button"`
- `disabled: boolean` — disables the button
- `severity: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'danger'` — color variant; defaults to `"primary"`

**Outputs:**
- `onClick` — emits when the user clicks

**Base CSS:**

```css
button {
    cursor: pointer;
    color: var(--text-inverse);   /* text always legible over colored background */
    padding: 5px 10px;
    border: none;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    width: 100%;
    transition: background-color 0.2s, box-shadow 0.2s;
}
```

**Color rules by severity** (CSS classes applied directly with the severity name):
- Resting background: `var(--color-<severity>)`
- Hover/active background: `var(--color-<severity>-dark)`
- Focus ring: `box-shadow: 0 0 0 3px var(--color-<severity>-light)`
- Text: always `var(--text-inverse)` to guarantee contrast against the colored background
- Disabled: `opacity: 0.4` + `cursor: not-allowed`

---

### 5.2 InputText (`<component-inputText>`)

**Inputs/Models:**
- `formField: FieldTree<string, string>` (optional) — integration with Angular Forms Signals
- `placeholder: string`
- `value: string` — value when formField isn't used
- `readonly: boolean`
- `disabled: boolean`

**Visual behavior:** the input starts at `--bg-elevated` and rises to `--bg-overlay` on focus, following the layer hierarchy. The placeholder uses `--text-tertiary` for low visual emphasis. Validation errors trigger a semantic error tint (`--bg-error`) and replace the border and focus ring with their error equivalents.

---

### 5.3 InputPassword (`<component-inputPassword>`)

Identical to InputText in styles and behavior. The difference is that the `<input>` is `type="password"` and `formField` is **required** (not optional).

---

### 5.4 InputTextArea (`<component-inputTextArea>`)

**Additional Inputs/Models vs InputText:**
- `rows: number` — number of visible rows; defaults to `3`

Identical to InputText in styles. Additionally: `resize: none` in all states to keep the layout controlled.

---

### 5.5 ComboSelect (`<component-comboSelect>`)

**Inputs/Models:**
- `formField: FieldTree<string, string>` (optional)
- `value: string`
- `disabled: boolean`
- `items: { id: string | null, name: string }[]` — select options

**Styling particulars:**
- `appearance: none` is used to remove the browser's native selector.
- The right padding is larger (`36px`) to leave room for the custom arrow.
- The arrow is an **inline SVG** injected as `background-image`. The SVG's color depends on the theme and can't use CSS variables directly, so the light theme is overridden with `:host-context([data-theme="light"])`.
- The SVG uses each theme's `--text-secondary` color to blend with the interface text.
- Focus, error, and disabled: same pattern as text inputs.

---

### 5.6 Dialog (`<component-dialog>`)

**Inputs:**
- `open: boolean` — controls visibility; defaults to `false`

**HTML structure:**
```html
@if (this.open()) {
    <div class="dialog-content">   <!-- semi-transparent overlay -->
        <dialog [open]="this.open()">
            <ng-content />          <!-- content projected by the consumer -->
        </dialog>
    </div>
}
```

**CSS:**

```css
/* Overlay: covers the whole screen with a semi-transparent black background */
.dialog-content {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 1000;
}

/* Dialog panel: surface elevated above the overlay */
dialog {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    max-width: 400px;
    width: 100%;
}
```

The dialog's inner content (header, body, footer, buttons) is defined by the consuming component via `<ng-content />`. The dialog only provides the container and the overlay.

---

## 6. General rules for new components

1. **Never use hardcoded colors**. The hex values of the variables can change; the variable's semantic name is what should guide the styling decision.
2. **Typography**: `font-size: 14px` for form components. The system font is inherited automatically; no need to declare it.
3. **Form border**: always start from `1px solid var(--border-default)`.
4. **Border radius**: `var(--radius-md)` for most cases. `var(--radius-sm)` for very small elements. `var(--radius-lg)` for modals or large panels.
5. **Background of interactive controls**: start from `var(--bg-elevated)` at rest, rise to `var(--bg-overlay)` on focus.
6. **Background of read-only controls**: drop to `var(--bg-surface)` to communicate inactivity.
7. **Transitions**: always `transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s` on interactive elements.
8. **Focus**: remove `outline` and replace with `box-shadow: 0 0 0 3px`. Use `:focus-visible` on buttons; `:focus` on inputs.
9. **Disabled**: only `opacity: 0.4` + `cursor: not-allowed`. Don't change colors or borders.
10. **Text over colored backgrounds**: use `var(--text-inverse)` to guarantee legibility.
11. **Inline SVGs and assets that don't support CSS variables**: use `:host-context([data-theme="light"])` to adapt to the light theme.
12. **Shadows**: use only `--shadow-sm`, `--shadow-md`, or `--shadow-lg`. Don't invent shadows with custom values.
13. **z-index of overlays and modals**: `z-index: 1000`.

---

## 7. Severity scale

The app standardizes the concept of **severity** for components with color variants. It lets the same component (button, badge, alert) adopt the correct color for the context by declaring only the severity.

| Severity    | When to use it                                                                 |
|-------------|-------------------------------------------------------------------------------|
| `primary`   | The screen's main action. CTA, submit, active navigation.             |
| `secondary` | Secondary or cancel actions. Lower visual hierarchy than primary.         |
| `accent`    | Visual accents or alternative actions. Chromatic variety without semantic weight. |
| `success`   | Confirm, save, successful validation.                                       |
| `warning`   | Caution. The action is valid but the user should review it.             |
| `error`     | Validation error, irreversibly destructive action.                   |
| `info`      | Neutral information, help, documentation.                                   |
| `danger`    | Risky action with confirmation (e.g. delete with a confirmation modal).    |

**Usage pattern for each severity's three variants:**
- Resting: base color (`--color-<severity>`)
- Hover and active: dark color (`--color-<severity>-dark`)
- Focus ring: light color (`--color-<severity>-light`)
- Tint background (semantic states in inputs/alerts): `--bg-<severity>`
- Semantic border (focus ring on error/success): `--border-<severity>`

---

## 8. Angular file structure

- Components use **standalone** (no NgModules, `standalone: true` isn't declared in the decorator).
- `ChangeDetectionStrategy.OnPush` mandatory on every component.
- Local state with **signals** (`signal()`, `computed()`).
- Inputs with `input()`, outputs with `output()`, two-way bindings with `model()`.
- Native control flow: `@if`, `@for`, `@switch`. Never `*ngIf`, `*ngFor`, `*ngSwitch`.
- Dependency injection with `inject()`. Never constructor injection.
- Template and style paths **relative** to the `.ts` file.
</content>
