/**
 * Data-row interaction binder.
 * Isolates repeated expand/collapse and payload toggle wiring from UIManager.
 */

/**
 * Bind data-row expansion and payload toggle interactions.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.content - Current rendered view root
 */
export function bindDataRowInteractions(params) {
	const content = params?.content;
	if (!content) return;

	// Hero row expand/collapse (heroes view only)
	content.querySelectorAll('.oj-hero-row[data-hero-id]').forEach((row) => {
		row.addEventListener('click', () => {
			const hId = row.dataset.heroId;
			const detailRow = content.querySelector(`tr.oj-hero-detail[data-detail-for="${hId}"]`);
			if (detailRow) {
				const isHidden = detailRow.style.display === 'none';
				detailRow.style.display = isHidden ? '' : 'none';
				row.classList.toggle('oj-expanded', isHidden);
			}
		});
	});

	// Titan row expand/collapse (titans view only)
	content.querySelectorAll('.oj-titan-row[data-titan-id]').forEach((row) => {
		row.addEventListener('click', () => {
			const tId = row.dataset.titanId;
			const detailRow = content.querySelector(`tr.oj-titan-detail[data-detail-for="${tId}"]`);
			if (detailRow) {
				const isHidden = detailRow.style.display === 'none';
				detailRow.style.display = isHidden ? '' : 'none';
				row.classList.toggle('oj-expanded', isHidden);
			}
		});
	});

	// Pet row expand/collapse (pets view only)
	content.querySelectorAll('.oj-pet-row[data-pet-id]').forEach((row) => {
		row.addEventListener('click', () => {
			const pId = row.dataset.petId;
			const detailRow = content.querySelector(`tr.oj-pet-detail[data-detail-for="${pId}"]`);
			if (detailRow) {
				const isHidden = detailRow.style.display === 'none';
				detailRow.style.display = isHidden ? '' : 'none';
				row.classList.toggle('oj-expanded', isHidden);
			}
		});
	});

	// Battle row expand/collapse (#111 — show team compositions with avatars)
	content.querySelectorAll('.oj-battle-row[data-battle-id]').forEach((row) => {
		row.addEventListener('click', () => {
			const bId = row.dataset.battleId;
			const detailRow = content.querySelector(`tr.oj-battle-detail[data-detail-for="${bId}"]`);
			if (detailRow) {
				const isHidden = detailRow.style.display === 'none';
				detailRow.style.display = isHidden ? '' : 'none';
				row.classList.toggle('oj-expanded', isHidden);
			}
		});
	});

	// API Log payload expand/collapse (#91)
	content.querySelectorAll('.oj-payload-toggle').forEach((btn) => {
		btn.addEventListener('click', () => {
			const idx = btn.getAttribute('data-log-idx');
			const payloadDiv = content.querySelector(`.oj-log-payload[data-log-idx="${idx}"]`);
			if (payloadDiv) {
				const isHidden = payloadDiv.style.display === 'none';
				payloadDiv.style.display = isHidden ? '' : 'none';
				btn.textContent = isHidden ? '\uD83D\uDD0D Hide Payload' : '\uD83D\uDD0D Payload';
			}
		});
	});
}
