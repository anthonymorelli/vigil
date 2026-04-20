"""
+EV Prop Screen — Streamlit MVP
Real data from OddsBlaze snapshot, devigged against Novig + ProphetX exchanges.
"""

import streamlit as st
import pandas as pd
from datetime import datetime

from pipeline import fetch_opportunities_from_snapshot


# ============================================================================
# PAGE CONFIG
# ============================================================================

st.set_page_config(
    page_title="Prop Screen",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    [data-testid="stMetric"] {
        background: #1a1d24;
        padding: 14px 18px;
        border-radius: 10px;
        border: 1px solid #2a2f3a;
    }
    [data-testid="stSidebar"] { background: #0f1115; }
    .block-container { padding-top: 2rem; }
</style>
""", unsafe_allow_html=True)


# ============================================================================
# DATA
# ============================================================================

@st.cache_data(ttl=30)
def fetch_opportunities() -> pd.DataFrame:
    """Returns real +EV opportunities from the OddsBlaze snapshot."""
    return fetch_opportunities_from_snapshot()


# Load once so sidebar filters can derive their options from real data
df = fetch_opportunities()

available_markets = sorted(df["Market"].unique().tolist()) if not df.empty else []
available_books = sorted(df["Book"].unique().tolist()) if not df.empty else []


# ============================================================================
# SIDEBAR FILTERS
# ============================================================================

with st.sidebar:
    st.markdown("### 🎯 Filters")

    min_ev = st.slider("Min EV %", -10.0, 15.0, -5.0, step=0.5)

    selected_markets = st.multiselect("Markets", available_markets, default=available_markets)
    selected_books = st.multiselect("Books", available_books, default=available_books)
    side_filter = st.radio("Side", ["Both", "Over", "Under"], horizontal=True)

    st.markdown("---")
    st.markdown("### ⚙️ Refresh")
    auto_refresh = st.checkbox("Auto-refresh", value=False)
    interval = st.selectbox("Interval (sec)", [15, 30, 60, 120], index=1)

    if auto_refresh:
        try:
            from streamlit_autorefresh import st_autorefresh
            st_autorefresh(interval=interval * 1000, key="refresher")
        except ImportError:
            st.warning("`pip install streamlit-autorefresh` to enable")

    if st.button("🔄 Refresh now", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    st.markdown("---")
    st.caption(f"Last fetch: {datetime.now().strftime('%H:%M:%S')}")


# ============================================================================
# MAIN
# ============================================================================

st.title("📊 +EV Prop Screen")
st.caption("Personal +EV scanner — devigged against Novig + ProphetX exchanges • NBA player props")

df_f = df[
    (df["EV %"] >= min_ev)
    & (df["Market"].isin(selected_markets))
    & (df["Book"].isin(selected_books))
].copy()

if side_filter == "Over":
    df_f = df_f[df_f["Side"].str.lower() == "over"]
elif side_filter == "Under":
    df_f = df_f[df_f["Side"].str.lower() == "under"]

c1, c2, c3, c4 = st.columns(4)
c1.metric("Opportunities", len(df_f))
c2.metric("Best EV", f"{df_f['EV %'].max():.2f}%" if len(df_f) else "—")
c3.metric("Avg EV", f"{df_f['EV %'].mean():.2f}%" if len(df_f) else "—")
c4.metric("Books active", df_f["Book"].nunique() if len(df_f) else 0)

st.markdown("---")

if len(df_f) == 0:
    st.info("No opportunities match current filters. Try lowering Min EV.")
else:
    df_display = df_f.copy()
    df_display["Updated"] = df_display["Updated"].apply(
        lambda t: f"{int((datetime.now() - t).total_seconds())}s ago"
    )

    styler = (
        df_display.style
        .background_gradient(subset=["EV %"], cmap="RdYlGn", vmin=-5, vmax=5)
        .background_gradient(subset=["Kelly %"], cmap="Blues", vmin=0, vmax=5)
        .format({
            "Line": "{:.1f}",
            "Odds": "{:+d}",
            "Fair Odds": "{:+d}",
            "Fair %": "{:.1f}%",
            "EV %": "{:+.2f}%",
            "Kelly %": "{:.2f}%",
        })
    )

    st.dataframe(styler, use_container_width=True, hide_index=True, height=550)

    st.markdown("---")
    st.markdown("### 🔍 Compare a play across books")

    play_options = {}
    for _, r in df_f.iterrows():
        key = f"{r['Player']} {r['Side']} {r['Line']} {r['Market']}"
        play_options.setdefault(key, (r['Player'], r['Side'], r['Line'], r['Market']))

    selected = st.selectbox("Pick a play", list(play_options.keys()))

    if selected:
        player, side, line, market = play_options[selected]
        comp = df[
            (df["Player"] == player)
            & (df["Side"] == side)
            & (df["Line"] == line)
            & (df["Market"] == market)
        ].sort_values("EV %", ascending=False)

        hdr = st.columns([2, 1, 1, 1, 1])
        hdr[0].markdown("**Book**")
        hdr[1].markdown("**Odds**")
        hdr[2].markdown("**Fair**")
        hdr[3].markdown("**EV %**")
        hdr[4].markdown("**Kelly**")

        for _, row in comp.iterrows():
            cols = st.columns([2, 1, 1, 1, 1])
            cols[0].markdown(f"**{row['Book']}**")
            cols[1].markdown(f"`{int(row['Odds']):+d}`")
            cols[2].markdown(f"`{int(row['Fair Odds']):+d}`")
            ev = row['EV %']
            color = "#22c55e" if ev > 3 else "#eab308" if ev > 0 else "#6b7280"
            cols[3].markdown(
                f"<span style='color:{color};font-weight:600'>{ev:+.2f}%</span>",
                unsafe_allow_html=True,
            )
            cols[4].markdown(f"{row['Kelly %']:.2f}%")