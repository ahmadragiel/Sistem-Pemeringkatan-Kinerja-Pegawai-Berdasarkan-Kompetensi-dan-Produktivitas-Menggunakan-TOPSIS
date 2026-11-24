import { initNavigation } from './core/navigation.js';
import { initFlash } from './components/flash.js';
import { initPrintControls } from './components/print.js';
import { initFormBusyState } from './components/forms.js';
import { initConfirmDialog } from './components/dialogs.js';
import { initWeightCalculator } from './pages/weights.js';

initNavigation();
initFlash();
initPrintControls();
initFormBusyState();
initConfirmDialog();
initWeightCalculator();
