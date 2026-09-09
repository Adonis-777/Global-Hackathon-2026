# Implementation Plan: Next Precautionary Steps Section

## 1. Objective
Add a dynamic "Next precautionary steps" section to the Citizen PWA (`apps/citizen-pwa`) that provides actionable advice based on the current flood risk level (HIGH, MODERATE, LOW).

## 2. Requirements Mapping
- **Quantum² Aesthetic**: Use `CyberCard` as container, `CyberLabel` for text, and cyan visual markers.
- **Dynamic Content**:
    - **HIGH**: Urgent steps (evacuation, avoid underpasses).
    - **MODERATE**: Cautionary steps (monitor updates, emergency kits).
    - **LOW**: General awareness (drainage, staying informed).
- **Integration**: Place prominently in `RiskMapPage.tsx`, below the map/advice grid.

## 3. Detailed Design

### 3.1 Precautionary Steps Content Mapping
| Risk Level | Badge Text | Badge Variant | Advice Steps |
| :--- | :--- | :--- | :--- |
| **HIGH** | URGENT | `danger` | - Evacuate to higher ground immediately.<br>- Avoid all underpasses and low-lying roads.<br>- Contact emergency services if stranded.<br>- Follow instructions from local authorities. |
| **MODERATE** | CAUTION | `warning` | - Monitor real-time weather and flood updates.<br>- Avoid known flood-prone areas and riverbanks.<br>- Prepare an emergency kit (water, torch, first-aid).<br>- Secure loose outdoor items. |
| **LOW** | AWARENESS | `accent` | - Keep residential drainage and gutters clear.<br>- Stay informed via the Citizen PWA.<br>- Plan alternative routes for your daily commute.<br>- Report any minor waterlogging via the Uplink feature. |

### 3.2 Component Architecture: `PrecautionarySteps`
- **File Path**: `apps/citizen-pwa/src/components/PrecautionarySteps.tsx`
- **Props**: `severity: SeverityLevel`
- **UI Structure**:
    - `CyberCard` (Container)
        - `title`: "Next precautionary steps"
        - `subtitle`: "Actionable advice based on current risk level"
        - `badge`: Dynamic based on severity
        - `badgeVariant`: Dynamic based on severity
        - **Body**: A list of items where each item is:
            - A `div` with `flex items-start gap-2 py-1`
            - A cyan bullet: `<span className="text-[#38c6ec] shrink-0">✦</span>`
            - A `CyberLabel` (variant `body`, color `white`) containing the step text.

### 3.3 Integration in `RiskMapPage.tsx`
- **Logic**:
    - Determine the active severity level: `const activeSeverity = selectedCell?.severity || 'LOW';`
- **Placement**:
    - Insert the `<PrecautionarySteps severity={activeSeverity} />` component after the `grid grid-cols-1 lg:grid-cols-3 gap-6` block (the map and hazard advice panel) and before the `Safe Route Guidance Modal`.

## 4. Implementation Steps

1.  **Create `PrecautionarySteps` Component**:
    - Create `apps/citizen-pwa/src/components/PrecautionarySteps.tsx`.
    - Implement the severity-to-content mapping.
    - Build the UI using `CyberCard` and `CyberLabel`.
2.  **Integrate into `RiskMapPage`**:
    - Import `PrecautionarySteps` into `apps/citizen-pwa/src/pages/RiskMapPage.tsx`.
    - Calculate `activeSeverity` based on `selectedCell`.
    - Add the component to the JSX layout.

## 5. Verification Plan

- **Test HIGH Risk**: Select a cell with `HIGH` severity. Verify red "URGENT" badge and urgent advice list.
- **Test MODERATE Risk**: Select a cell with `MODERATE` severity. Verify yellow "CAUTION" badge and cautionary advice list.
- **Test LOW/Default Risk**: Select a cell with `LOW` severity or no cell. Verify cyan "AWARENESS" badge and general awareness advice.
- **UI Review**: Confirm alignment, font (Figtree), and high-contrast colors match the Quantum² Design System.
