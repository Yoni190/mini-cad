import Wall from '../models/Wall';
import Column from '../models/Column';

/** Rebuild model methods and validate all saved elements before replacing a drawing. */
export default function restoreElements(elements) {
    if (!Array.isArray(elements)) throw new Error('Invalid project elements');

    return elements.map(element => {
        if (element?.type === 'wall') {
            const thicknessSide = ['1', '-1'].includes(element.thicknessSide)
                ? Number(element.thicknessSide) : element.thicknessSide;
            return new Wall({ ...element, thicknessSide });
        }
        if (element?.type === 'column') return new Column(element);
        throw new Error(`Unsupported element type: ${element?.type}`);
    });
}
