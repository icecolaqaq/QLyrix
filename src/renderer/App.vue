<template>
	<div class="window-controls" @mouseenter="controlsVisible = true" @mouseleave="controlsVisible = false":style="{ opacity: controlsVisible ? 1 : 0 }">
		<div class="drag-area"></div>
		<div class="controls-buttons">
			<button @click="minimizeWindow" class="btn-minimize"><el-icon :size="13"><Minus /></el-icon></button>
			<button @click="maximizeWindow" class="btn-maximize"><el-icon :size="13"><Plus /></el-icon></button>
			<button @click="closeWindow" class="btn-close"><el-icon :size="13"><Close /></el-icon></button>
		</div>
  	</div>
	<BackgroundRender :album="state.albumUrl" :album-is-video="false" ref="bgRef" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" />
		<div class="base_container" style="height: 100%;width: 100%; position: absolute; top: 0; left: 0; z-index: 5000;">
			<el-row :gutter="22" style="height: 100%;">
				<el-col v-if="normalmode" :span="11">
					<div class="play_background">
						<div class="play_container">
							<div class="play_container_topbar">
								<MiniBar :onClose="closeWindow":onMaximize="maximizeWindow":onMinimize="minimizeWindow":onFullscreen="fullscreenWindow"/>
							</div>
							<div class="song_album_container">
								<img class='song_album' :style="{ transform: `${display.scale}` }" :src="state.albumUrl">
							</div>
							<div class="song_info_container">
								<div class="song_info">
									<div class="song_name">{{state.title}}</div>
									<div class="song_artist">{{state.artist}}</div>
								</div>
								<div class="menubutton" @click="showStatusDialog"><div class="menubutton_text">...</div></div>
							</div>
							<div class="song_timeline_container">
								<div class="song_progress_container">
									<div class="song_progress_background" 
										@mousedown="startProgressDrag"
										ref="progressContainer">
									<div class="song_progress" :style="{ width: `${display.progress}%` }"></div>
									</div>
								</div>
								<div class="song_others">
									<div class="song_time_left">{{display.nowtime}}</div>
									<div class="song_qualitytag">
										<el-icon v-if="!isProgressDragging" :size="15"><svg t="1743772355024" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="13779" width="200" height="200"><path d="M783.530667 826.168889a42.638222 42.638222 0 0 1-30.165334-72.832A339.128889 339.128889 0 0 0 853.333333 512c0-91.164444-35.498667-176.881778-99.982222-241.365333a42.638222 42.638222 0 0 1 0-60.330667 42.638222 42.638222 0 0 1 60.344889 0C894.293333 290.872889 938.666667 398.023111 938.666667 511.985778c0 113.962667-44.373333 221.112889-124.970667 301.696a42.524444 42.524444 0 0 1-30.165333 12.501333M240.469333 826.168889a42.524444 42.524444 0 0 1-30.151111-12.487111C129.706667 733.098667 85.333333 625.948444 85.333333 511.985778c0-113.948444 44.373333-221.112889 124.970667-301.696a42.638222 42.638222 0 0 1 60.330667 0 42.638222 42.638222 0 0 1 0 60.330666A339.143111 339.143111 0 0 0 170.666667 511.971556c0 91.164444 35.498667 176.910222 99.982222 241.379555a42.638222 42.638222 0 0 1-30.179556 72.817778" fill="#FFFFFFB5" p-id="13780"></path><path d="M662.840889 705.493333a42.666667 42.666667 0 0 1-30.165333-72.846222A169.457778 169.457778 0 0 0 682.666667 512c0-45.596444-17.749333-88.448-49.991111-120.689778a42.638222 42.638222 0 0 1 0-60.330666 42.638222 42.638222 0 0 1 60.330666 0A254.293333 254.293333 0 0 1 768 512a254.293333 254.293333 0 0 1-74.993778 181.020444 42.552889 42.552889 0 0 1-30.151111 12.487112M361.159111 705.493333a42.552889 42.552889 0 0 1-30.165333-12.487111A254.293333 254.293333 0 0 1 256 512a254.293333 254.293333 0 0 1 74.993778-181.020444 42.638222 42.638222 0 0 1 60.330666 0 42.638222 42.638222 0 0 1 0 60.330666A169.543111 169.543111 0 0 0 341.333333 512c0 45.596444 17.749333 88.433778 49.991111 120.661333a42.666667 42.666667 0 0 1-30.165333 72.846223M597.333333 511.985778a85.333333 85.333333 0 0 1-170.666666 0 85.333333 85.333333 0 0 1 170.666666 0" fill="#FFFFFFA5" p-id="13781"></path></svg></el-icon>
										<a style="font-size: 13px; color: #FFFFFFA5; margin-left: 5px;">{{ display.tagstr }}</a>
									</div>
									<div class="song_time_right">{{display.endTime}}</div>
								</div>
							</div>
							<div class="song_play_controls">
								<div class="song_play_control_m b_random" @click="nofunciton">
									<el-icon :size="20"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.3536 1.14645C12.1583 0.951184 11.8417 0.951184 11.6464 1.14645C11.4512 1.34171 11.4512 1.65829 11.6464 1.85355L12.7929 3H12C10.7037 3 9.71111 3.58423 8.87248 4.38931C8.20065 5.03427 7.59349 5.85684 6.99461 6.6682C6.86287 6.84668 6.73154 7.02462 6.6 7.2C5.10874 9.18835 3.49037 11 0.5 11C0.223858 11 0 11.2239 0 11.5C0 11.7761 0.223858 12 0.5 12C4.00963 12 5.89126 9.81165 7.4 7.8C7.54367 7.60845 7.6832 7.41962 7.81996 7.23454L7.82005 7.23443L7.82006 7.23441C8.41674 6.42695 8.96069 5.69085 9.56502 5.11069C10.2889 4.41577 11.0463 4 12 4H12.7929L11.6464 5.14645C11.4512 5.34171 11.4512 5.65829 11.6464 5.85355C11.8417 6.04882 12.1583 6.04882 12.3536 5.85355L14.3536 3.85355C14.5488 3.65829 14.5488 3.34171 14.3536 3.14645L12.3536 1.14645ZM0.5 3C3.35278 3 5.12992 4.44588 6.50548 6.06746L6.3762 6.24266C6.2483 6.4161 6.12293 6.58609 6 6.75C5.96397 6.79804 5.92798 6.84581 5.892 6.89331C4.57348 5.29306 3.02637 4 0.5 4C0.223858 4 0 3.77614 0 3.5C0 3.22386 0.223858 3 0.5 3ZM8.87248 10.6107C8.37284 10.131 7.90897 9.55314 7.45767 8.95468C7.64688 8.71693 7.82704 8.48061 8 8.25L8.08987 8.12987C8.58412 8.79402 9.05288 9.39766 9.56502 9.88931C10.2889 10.5842 11.0463 11 12 11H12.7929L11.6464 9.85355C11.4512 9.65829 11.4512 9.34171 11.6464 9.14645C11.8417 8.95118 12.1583 8.95118 12.3536 9.14645L14.3536 11.1464C14.5488 11.3417 14.5488 11.6583 14.3536 11.8536L12.3536 13.8536C12.1583 14.0488 11.8417 14.0488 11.6464 13.8536C11.4512 13.6583 11.4512 13.3417 11.6464 13.1464L12.7929 12H12C10.7037 12 9.71111 11.4158 8.87248 10.6107Z" fill="#ffffff60" fill-rule="evenodd" clip-rule="evenodd"></path></svg></el-icon>
								</div>
								<div class="song_play_control b_prev" @click="playerprev" >
									<el-icon :size="45"><svg t="1743775883682" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="54062" width="200" height="200"><path d="M81.21 478.57l418.81-264.24c17.53-10.96 40.62-5.63 51.57 11.91 3.73 5.97 5.7 12.87 5.69 19.91v187.13l345.45-218.2c17.53-10.96 40.62-5.63 51.57 11.91 3.73 5.97 5.7 12.87 5.69 19.91v531.09c-0.03 20.67-16.82 37.4-37.49 37.37a37.465 37.465 0 0 1-20.15-5.93L556.91 588.24v189.75c-0.03 20.67-16.82 37.4-37.49 37.37a37.465 37.465 0 0 1-20.15-5.93L80.47 541.08c-17.12-11.58-21.62-34.85-10.04-51.96 2.84-4.22 6.51-7.8 10.78-10.55z" fill="#ffffff" p-id="54063"></path></svg></el-icon>
								</div>
								<div class="song_play_control b_play" @click="playerplay">
									<el-icon v-if="state.isPlay" :size="55"><svg t="1743776286073" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="69609" width="200" height="200"><path d="M307.785143 861.074286h97.28c37.723429 0 56.996571-19.712 56.996571-57.417143V219.904c0-38.985143-19.273143-56.996571-56.996571-56.996571h-97.28c-37.723429 0-57.417143 19.712-57.417143 56.996571V803.657143c0 37.723429 19.712 57.417143 57.417143 57.417143z m311.149714 0h97.28c37.723429 0 57.417143-19.712 57.417143-57.417143V219.904c0-38.985143-19.712-56.996571-57.417143-56.996571h-97.28c-37.723429 0-56.996571 19.712-56.996571 56.996571V803.657143c0 37.723429 19.273143 57.417143 56.996571 57.417143z" p-id="69610" fill="#ffffff"></path></svg></el-icon>
									<el-icon v-else :size="55"><svg t="1743777071679" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1473" width="200" height="200"><path d="M810.4 465.8 253.6 134.4c-6.8-4-13.8-6.4-21.8-6.4-21.8 0-39.6 18-39.6 40L192 168l0 688 0.2 0c0 22 17.8 40 39.6 40 8.2 0 15-2.8 22.4-6.8l556.2-331c13.2-11 21.6-27.6 21.6-46.2C832 493.4 823.6 477 810.4 465.8z" p-id="1474" fill="#ffffff"></path></svg></el-icon>
								</div>
								<div class="song_play_control b_next" @click="playernext">
									<el-icon :size="45"><svg t="1743775838250" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="52070" width="200" height="200"><path d="M943.45 545.33L525.22 809.2c-17.5 10.94-40.56 5.62-51.5-11.89a37.27 37.27 0 0 1-5.68-19.88V590.55l-344.98 217.9c-16.81 11.97-40.15 8.05-52.13-8.76A37.46 37.46 0 0 1 64 777.43V245.95c0.03-20.64 16.79-37.35 37.43-37.32a37.44 37.44 0 0 1 20.12 5.92l344.98 220.89v-189.5c0.03-20.64 16.79-37.35 37.43-37.32a37.44 37.44 0 0 1 20.12 5.92l418.23 267.98c17.54 10.89 22.93 33.93 12.05 51.46-2.8 4.51-6.52 8.37-10.92 11.32l0.01 0.03z" fill="#ffffff" p-id="52071"></path></svg></el-icon>
								</div>
								<div class="song_play_control_m b_cycle" @click="nofunciton">
									<el-icon :size="20"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.35355 1.85355C3.54882 1.65829 3.54882 1.34171 3.35355 1.14645C3.15829 0.951184 2.84171 0.951184 2.64645 1.14645L0.646447 3.14645C0.451184 3.34171 0.451184 3.65829 0.646447 3.85355L2.64645 5.85355C2.84171 6.04882 3.15829 6.04882 3.35355 5.85355C3.54882 5.65829 3.54882 5.34171 3.35355 5.14645L2.20711 4H9.5C11.433 4 13 5.567 13 7.5C13 7.77614 13.2239 8 13.5 8C13.7761 8 14 7.77614 14 7.5C14 5.01472 11.9853 3 9.5 3H2.20711L3.35355 1.85355ZM2 7.5C2 7.22386 1.77614 7 1.5 7C1.22386 7 1 7.22386 1 7.5C1 9.98528 3.01472 12 5.5 12H12.7929L11.6464 13.1464C11.4512 13.3417 11.4512 13.6583 11.6464 13.8536C11.8417 14.0488 12.1583 14.0488 12.3536 13.8536L14.3536 11.8536C14.5488 11.6583 14.5488 11.3417 14.3536 11.1464L12.3536 9.14645C12.1583 8.95118 11.8417 8.95118 11.6464 9.14645C11.4512 9.34171 11.4512 9.65829 11.6464 9.85355L12.7929 11H5.5C3.567 11 2 9.433 2 7.5Z" fill="#ffffffA0" fill-rule="evenodd" clip-rule="evenodd"></path></svg></el-icon>
								</div>
							</div>
							<div class="song_sound_controls">
								<div class="song_sound_controls_volume_add">
									<el-icon :size="20" ><svg t="1743778091857" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3487" width="200" height="200"><path d="M64 288h192l201.376-201.376A32 32 0 0 1 512 109.248v805.504a32 32 0 0 1-54.624 22.624L256 736H64a32 32 0 0 1-32-32V320a32 32 0 0 1 32-32z" p-id="3488" fill="#ffffff"></path></svg></el-icon>
								</div>
								<div class="song_sound_controls_sound_progress_container" @mousedown="startVolumeDrag" ref="volumeContainer">
									<div class="song_sound_controls_sound_progress_background">
										<div class="song_sound_controls_sound_progress" 
											:style="{ width: `${display.volume}%` }"
											ref="volumeProgress"></div>
										</div>
								</div>
								<div class="song_sound_controls_volume_minus">
									<el-icon :size="20"><svg t="1743777918295" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1474" width="200" height="200"><path d="M625.152 398.848a160 160 0 0 1 0 226.304 32 32 0 0 1-45.28-45.28 96 96 0 0 0 0-135.744 32 32 0 0 1 45.28-45.28z m226.24-226.24c187.456 187.424 187.456 491.36 0 678.816a32 32 0 1 1-45.248-45.28c162.464-162.432 162.464-425.856 0-588.288a32 32 0 0 1 45.28-45.28z m-113.12 113.12c124.96 124.96 124.96 327.584 0 452.544a32 32 0 0 1-45.248-45.248 256 256 0 0 0 0-362.048A32 32 0 0 1 738.24 285.76zM64 288h192l201.376-201.376A32 32 0 0 1 512 109.248v805.504a32 32 0 0 1-54.624 22.624L256 736H64a32 32 0 0 1-32-32V320a32 32 0 0 1 32-32z" p-id="1475" fill="#ffffff"></path></svg></el-icon>
								</div>
							</div>
						</div>
					</div>
				</el-col>
			<el-col :span="normalmode? 11 : 24">
				<div class="box_right">
					<div class="song_play_info" v-if="!normalmode">
						<div class="mini_info">
							<div class="play_container_topbar_mini">
								<MiniBar :onClose="closeWindow":onMaximize="maximizeWindow":onMinimize="minimizeWindow":onFullscreen="fullscreenWindow"/>
							</div>

							<el-row class="mini_container" :gutter="20">
								<el-col :span="8"><div class="grid-content ep-bg-purple" />
									<img class='song_album_mini' :src="state.albumUrl" >
								</el-col>
								<el-col :span="14">
									<div class="song_info_container_mini">
										<div class="song_info_mini">
											<div class="song_name">{{state.title}}</div>
											<div class="song_artist">{{state.artist}}</div>
										</div>
									</div>
								</el-col>
									<el-col :span="2"><div class="menubutton_mini" @click="nofunciton"><div class="menubutton_text_mini">...</div></div>
								</el-col>
							</el-row>
						</div>
					</div>
					<div class="Lyric_container" :style="{ transform: `${display.Lyricscale}` }" >
						<LyricPlayer  @line-click="e => { lineclink(e.line.getLine().startTime) }" :lyric-lines="state.lyricLines" :current-time="state.currentTime" :playing="state.isPlay" ref="playerRef" style=" width: 100%; height: 100%;" mix-blend-mode: plus-lighter></LyricPlayer>
					</div>
				</div>
			</el-col>
		</el-row>
	</div>
	<div class="bottonbuttons" v-if="normalmode">
		<div class="button_share" style="margin-left: 3%;" @click="nofunciton">
			<el-icon :size="20"><svg t="1743781284379" class="icon" viewBox="0 0 1080 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4612" width="200" height="200"><path d="M541.505506 538.55512m-71.837602 0a71.837602 71.837602 0 1 0 143.675204 0 71.837602 71.837602 0 1 0-143.675204 0Z" p-id="4613" fill="#ffffff60"></path><path d="M613.378014 741.414315a38.624056 38.624056 0 0 1-15.70793-73.897086 140.865229 140.865229 0 1 0-117.565133-1.308994 38.624056 38.624056 0 1 1-33.07392 69.813024 218.1657 218.1657 0 1 1 182.124727 2.059484 38.397163 38.397163 0 0 1-15.777744 3.333572z" p-id="4614" fill="#ffffff60"></path><path d="M396.992546 887.358441a38.397163 38.397163 0 0 1-16.179168-3.490651 381.807428 381.807428 0 0 1-220.958221-345.487202c0-209.753231 170.657937-380.480981 380.480981-380.480981s380.480981 170.657937 380.48098 380.480981a378.840375 378.840375 0 0 1-208.845661 339.483282 38.624056 38.624056 0 1 1-34.906512-68.905455 301.941329 301.941329 0 0 0 166.399343-270.64764c0-167.167286-135.995771-303.18051-303.18051-303.18051s-303.197963 136.013224-303.197963 303.18051a304.332425 304.332425 0 0 0 176.120806 275.394926 38.624056 38.624056 0 0 1-16.214075 73.687647z" p-id="4615" fill="#ffffff60"></path><path d="M308.574351 1023.999983a38.571696 38.571696 0 0 1-17.819774-4.345861A539.043811 539.043811 0 0 1 0.000785 540.282993C0.000785 242.373366 242.374151 0 540.266325 0s540.282993 242.373366 540.282992 540.282993a540.265539 540.265539 0 0 1-282.742747 475.042721 38.624056 38.624056 0 0 1-36.861276-67.875712 463.069788 463.069788 0 0 0 242.373366-407.167009c0-255.323682-207.693746-463.034882-463.052335-463.034882S77.26635 284.959311 77.26635 540.282993a462.022593 462.022593 0 0 0 249.249949 410.849646 38.624056 38.624056 0 0 1-17.907041 72.867344z" p-id="4616" fill="#ffffff60"></path></svg></el-icon>
		</div>
		<div class="button_right" style="margin-right: 3%; width: 50%;">
			<div class="button_translate" @click="showtranslate" style="margin-right: 1%;">
				<el-icon :size="32"><svg t="1744542154700" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10617" width="200" height="200"><path d="M677.676657 294.6142c19.165116 57.5433 44.715939 102.2992 89.431879 147.0551 38.322239-38.3622 63.873063-89.5118 83.038178-147.0551h-172.470057z m-421.56861 319.685h166.076358l-83.038179-223.7795-83.038179 223.7795z" fill="#ffffff60" p-id="10618"></path><path d="M894.854661 0.504H128.353929C58.095158 0.504 0.607803 58.0473 0.607803 128.378v767.244c0 70.3307 57.487355 127.874 127.746126 127.874h766.500733c70.258771 0 127.746126-57.5433 127.746126-127.874V128.378c0-70.3307-51.101647-127.874-127.746126-127.874zM581.867062 825.2913c-12.771416 12.7874-25.550824 12.7874-38.322239 12.7874-6.3937 0-19.165116 0-25.550824-6.3937-6.3937-6.3937-12.779408 0-12.779408-6.3937s-6.385708-12.7874-12.771415-25.5748c-6.3937-12.7874-6.3937-19.1811-12.779408-31.9685l-25.542832-70.3307H230.557224L205.0064 767.748c-12.771416 25.5748-19.165116 44.7559-25.550824 57.5433-6.3937 12.7874-19.165116 12.7874-38.322239 12.7874-12.779408 0-25.550824-6.3937-38.330231-12.7874-12.771416-12.7874-19.157124-19.1811-19.157124-31.9685 0-6.3937 0-12.7874 6.385708-25.5748 6.3937-12.7874 6.3937-19.1811 12.771416-31.9685l140.525533-358.0472c6.3937-12.7874 6.3937-25.5748 12.779408-38.3622 6.385708-12.7874 12.771416-25.5748 19.157124-31.9685 6.3937-6.3937 12.779408-19.1811 25.550823-25.5748 12.779408-6.3937 25.550824-6.3937 38.330232-6.3937 12.771416 0 25.542832 0 38.322239 6.3937 12.771416 6.3937 19.165116 12.7874 25.550824 25.5748 6.385708 6.3937 12.771416 19.1811 19.157124 31.9685 6.3937 12.7874 12.779408 25.5748 19.165115 44.7559l140.525534 351.6535c12.771416 25.5748 19.165116 44.7559 19.165116 57.5433-6.3937 6.3937-12.779408 19.1811-19.165116 31.9685zM933.176901 575.937c-70.258771-25.5748-121.360418-57.5433-166.076358-95.9055-44.707947 44.7559-102.195302 76.7244-172.462065 95.9055l-19.157124-31.9685c70.258771-19.1811 127.746126-44.7559 172.462066-89.5118C703.22748 409.7008 664.905241 352.1575 652.125833 288.2205h-63.873063v-25.5748h172.470058c-12.7874-19.1811-25.558816-44.7559-38.330232-63.937l19.157124-6.3937c12.779408 19.1811 31.944524 44.7559 44.715939 70.3307h159.682658v31.9685h-63.873063c-19.157124 63.937-51.093655 121.4803-89.423887 159.8425 44.715939 38.3622 95.809594 70.3307 166.076358 89.5118l-25.550824 31.9685z" fill="#ffffff60" p-id="10619"></path></svg></el-icon>
			</div>
			<div class="button_roma" @click="showroma">
				<el-icon :size="32" ><svg t="1744542191259" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10781" width="200" height="200"><path d="M540.621118 279.850932c19.080745 31.801242 38.161491 63.602484 76.322981 82.683229 38.161491-25.440994 69.962733-50.881988 89.043479-82.683229H540.621118z" fill="#ffffff60" p-id="10782"></path><path d="M903.15528 12.720497H120.84472C57.242236 12.720497 6.360248 63.602484 6.360248 127.204969v782.310559c0 63.602484 50.881988 114.484472 114.484472 114.484472h782.31056c63.602484 0 114.484472-50.881988 114.484472-114.484472V127.204969c0-63.602484-50.881988-114.484472-114.484472-114.484472z m-629.664597 190.807453c44.521739 31.801242 82.68323 69.962733 114.484472 101.763975l-44.521739 44.52174c-25.440994-31.801242-63.602484-63.602484-114.484472-101.763976l44.521739-44.521739z m6.360249 610.583851l-25.440994-57.242236c12.720497-12.720497 19.080745-25.440994 19.080745-38.16149v-254.409938H197.167702v-63.602485h146.285714v279.850932l57.242236-57.242236 19.080746 69.962733c-50.881988 44.521739-89.043478 89.043478-139.925466 120.84472z m527.900621-89.043478H636.024845v120.84472H572.42236v-120.84472H419.776398v-63.602484H572.42236v-63.602485H445.217391v-63.602484h127.204969v-57.242236h63.602485v57.242236h133.565217v57.242236H636.024845v63.602484h165.366459c6.360248 6.360248 6.360248 69.962733 6.360249 69.962733z m-6.360249-235.329193c-76.322981-6.360248-139.925466-25.440994-190.807453-57.242236-50.881988 25.440994-114.484472 44.521739-190.807453 63.602485L387.975155 445.217391c63.602484-12.720497 120.84472-31.801242 165.36646-50.881987-38.161491-31.801242-63.602484-69.962733-76.322981-114.484472h-44.52174v-57.242236h337.093168v57.242236c-19.080745 44.521739-50.881988 89.043478-95.403727 120.84472 38.161491 12.720497 89.043478 25.440994 152.645963 31.801242l-25.440994 57.242236z" fill="#ffffff60" p-id="10783"></path></svg></el-icon>
			</div>
		</div>	
	</div>
	<Transition name="fade"><div v-if="showEscPrompt" class="escexitprompt">按 ESC 退出全屏</div></Transition>
	<el-dialog v-model="statusDialogVisible" title="系统状态" width="60%" class="status-dialog" >
		<el-descriptions :column="1" border>
			<el-descriptions-item label="服务连接" >
				<span :class="state.server ? 'connected' : 'disconnected'">
					{{ state.server}}
				</span>
			</el-descriptions-item>
			
			<el-descriptions-item label="播放状态">
				{{ state.state  }}
			</el-descriptions-item>
			
			<el-descriptions-item label="歌曲ID">
				{{ state.id || '无' }}
			</el-descriptions-item>
			
			<el-descriptions-item label="当前曲目" >
				{{ state.title || '无' }}
			</el-descriptions-item>
			
			<el-descriptions-item label="艺术家">
				{{ state.artist || '未知' }}
			</el-descriptions-item>
			
			<el-descriptions-item label="专辑">
				{{ state.album || '未知' }}
			</el-descriptions-item>
			
			<el-descriptions-item label="音质" >
				<span class="quality-tag">{{ display.tagstr }}</span>
			</el-descriptions-item>
		</el-descriptions>
		
		<template #footer>
			<span class="dialog-footer">
				<el-button type="primary" @click="statusDialogVisible = false">
					关闭
				</el-button>
			</span>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import type { LyricLine } from "@applemusic-like-lyrics/core";
import { onMounted, reactive, ref,watch,onBeforeUnmount } from "vue";
import { BackgroundRender,type BackgroundRenderRef } from "./BackgroundRender";
import { LyricPlayer, type LyricPlayerRef } from "./LyricPlayer";
import "@applemusic-like-lyrics/core/style.css";
import { parseQrcLyric } from "./qmusiclrcpaser";
import { ElMessage } from "element-plus";
import { Minus,Close,Plus} from "@element-plus/icons-vue";
import MiniBar from './minibar.vue'
import "./qmusic.scss";

const audioRef = ref<HTMLAudioElement>();
let state = reactive({
	id: 0,
	title: "",
	artist: "",
	album: "",
	albumUrl: "",
	currentTime: 0,
	endTime: 0,
	lyricLines: [] as LyricLine[],
	quality: 0,
	isPlay: false,
	state: "",
	server: "",
});

let display = reactive({
	nowtime: "0:00",
	endTime: "-0:00",
	progress: 50,
	volume: 0,
	tagstr:'未知',
	scale: "scale(1)",
	Lyricscale: "scale(1.2)",
});

const playerRef = ref<LyricPlayerRef>();
const bgRef = ref<BackgroundRenderRef>();


// 监听窗口大小变化
const handleResize = () => {
  if (window.innerWidth < 890) {
    normalmode.value = false;
	display.Lyricscale = "scale(1)";
  } else {
    normalmode.value = true;
	display.Lyricscale = "scale(1.2)";
  }
  if(window.innerWidth / window.innerHeight > 1) {
	normalmode.value = true;
	display.Lyricscale = "scale(1.2)";
  }else {
	normalmode.value = false;
	display.Lyricscale = "scale(1)";
  }
}

onMounted(() => {
	window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
	document.removeEventListener('mousemove', handleVolumeDrag)
	document.removeEventListener('mouseup', stopVolumeDrag)
	window.removeEventListener('resize', handleResize);
})


const controlsVisible = ref(false);
const volumeContainer = ref<HTMLElement>() // 修改ref名称

let normalmode = ref(true)
let isDragging = false
let showEscPrompt = ref(false)
let statusDialogVisible = ref(false)
let translate = true
let roma = true
let lyricdata;
let templyricdata;
let setprogress = false

const showStatusDialog = () => {
    statusDialogVisible.value = true
}



const nofunciton = () => {
	ElMessage({
		plain: true,
		type: "success",
		message: "^.^ 啥也没有发生~",
	});	
}

const lineclink = (timestamp: number) => {
	setprogress = true;
	if(state.isPlay == true) {
		sendmassage("stop", null)
	}
	(async () => {
		sendmassage("progress", timestamp - 1300);
        await new Promise(resolve => setTimeout(resolve, 1300));
		setprogress = false;
    })()
}

const playerplay = () => {
	sendmassage("play", null)
}
const playernext = () => {
	sendmassage("next", null)
}
const playerprev = () => {
	sendmassage("prev", null)
}
const showtranslate = () => {
	if (translate == true) {
		translate = false;
		setlyricshow()
	}else {
		translate = true;
		setlyricshow()
	}
}
const showroma = () => {
	if (roma == true) {
		roma = false;
		setlyricshow()
	}else {
		roma = true;
		setlyricshow()
	}
}

function setlyricshow() {
	templyricdata = {...lyricdata}
	if (translate == false) {
		templyricdata.trans = "";	
	}else {
		templyricdata.trans = lyricdata.trans;
	}
	if (roma == false) {
		templyricdata.roma = "";	
	}else {
		templyricdata.roma = lyricdata.roma;	
	}
	state.lyricLines = parseQrcLyric(templyricdata);
}

const progressContainer = ref<HTMLElement>()
let isProgressDragging = false

const startProgressDrag = (e: MouseEvent) => {
  isProgressDragging = true
  document.addEventListener('mousemove', handleProgressDrag)
  document.addEventListener('mouseup', stopProgressDrag)
  updateProgress(e)
}

const stopProgressDrag = () => {
  if (isProgressDragging) {
    const timestamp = (display.progress / 100) * state.endTime;
		if (state.isPlay == true) {
			sendmassage("progress", timestamp - 7000);	
		}else {
			sendmassage("progress2", timestamp);
		}
	}
  (async () => {
        await new Promise(resolve => setTimeout(resolve, 1300));
        isProgressDragging = false
		settagstr(state.quality)
  })();
  
  document.removeEventListener('mousemove', handleProgressDrag)
  document.removeEventListener('mouseup', stopProgressDrag)
}

const handleProgressDrag = (e: MouseEvent) => {
  if (isProgressDragging) {
    requestAnimationFrame(() => updateProgress(e))
  }
}

const updateProgress = (e: MouseEvent) => {
  if (progressContainer.value) {
    const rect = progressContainer.value.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    let progress = Math.round((offsetX / rect.width) * 100)
    progress = Math.max(0, Math.min(100, progress))
    display.progress = progress
	const timestamp = (progress / 100) * state.endTime;
	const minutes = Math.floor(timestamp /1000 / 60);
	const seconds = Math.floor(timestamp /1000 % 60).toString().padStart(2, '0');
	display.tagstr = `${minutes}:${seconds}`;
  }
}

const startVolumeDrag = (e: MouseEvent) => {
  isDragging = true
  document.addEventListener('mousemove', handleVolumeDrag)
  document.addEventListener('mouseup', stopVolumeDrag)
  updateVolume(e) // 立即更新一次
}

const stopVolumeDrag = () => {
  if (isDragging) {
	sendmassage("volume", display.volume)
  }
  isDragging = false
  document.removeEventListener('mousemove', handleVolumeDrag)
  document.removeEventListener('mouseup', stopVolumeDrag)
}

const handleVolumeDrag = (e: MouseEvent) => {
  if (isDragging) {
    requestAnimationFrame(() => updateVolume(e)) // 使用动画帧节流
  }
}

const updateVolume = (e: MouseEvent) => {
  if (volumeContainer.value) {
    const rect = volumeContainer.value.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    let volume = Math.round((offsetX / rect.width) * 100)
    volume = Math.max(0, Math.min(100, volume))
    display.volume = volume
  }
}

const minimizeWindow = () => {
    sendmassage("minimize", null)
};

const maximizeWindow = () => {
	sendmassage("maximize", null)
};

const closeWindow = () => {
	sendmassage("close", null)
};

const fullscreenWindow = () => {
	sendmassage("fullscreen", null)
	showEsctip()
	
}

async function showEsctip() {
		showEscPrompt.value = true;
		setTimeout(() => {
			showEscPrompt.value = false;
		}, 2000);
}

const ipcRenderer = (window as any).ipcRenderer;

ipcRenderer.receive("qmusiclrc", (data) => {
	lyricdata = data;
	setqmusiclrc(data)
})

ipcRenderer.receive("qmusicinfo", (data) => {
	if (data.server == 1) {
		state.server = "已连接"
		switch (data.state) {
			case 0:
				// ElMessage.info("QQ音乐未启动");
				state.state = "QQ音乐未启动"
				break;
			case 1:
				state.state = "未检测到播放内容"
				break;
			case 2:
				state.state = "正常播放"
				state.id = data.id;
				state.title = data.title;
				state.artist = data.artist;
				state.album = data.album;
				state.albumUrl = data.cover;
				state.currentTime = data.progress;
				state.endTime = data.duration;
				state.quality = data.quality;
				if (isDragging == false) {
					state.isPlay = data.isPlaying;
					display.volume = data.volume;
				}
				break;
			case 3:
				state.state = "服务异常"
				break;
		}
	}else {
		state.server = "未连接"
	}
}	
);

function sendmassage(functionname: string, arg: any) {
	let data = {
		functionname: functionname,
		arg: arg,
	}
	ipcRenderer.send("qmusiccontrol", data);	
}


async function setqmusiclrc(data) {
	if (data != null) {
		const lyric = parseQrcLyric(data);
		state.lyricLines = lyric;
	} else {
		ElMessage.error("获取歌词失败"); 
	}
}

function settagstr(quality: number) {
	if (quality >= 3) {
			display.tagstr = "臻品";
		}else {
			switch (quality) {
				case 0:
					display.tagstr = "标准";
					break;	
				case 1:
					display.tagstr = "高品质";
					break;
				case 2:
					display.tagstr = "无损";
					break;
				default:
					display.tagstr = "未知";
					break;
			}
		}
}

watch(() => state.id, (newValue) => {
	setqmusiclrc(newValue)
	state.albumUrl = state.albumUrl;
	state.title = state.title;
	state.artist = state.artist;
	const minutes = Math.floor(state.endTime /1000 / 60);
	const seconds = Math.floor(state.endTime /1000 % 60).toString().padStart(2, '0');
	display.endTime = `-${minutes}:${seconds}`;
	settagstr(state.quality)
});

watch(() => state.currentTime, (newValue) => {
	if (setprogress == true) {
		return;
	}
	state.currentTime = newValue
	const minutes = Math.floor(newValue /1000 / 60);
	const seconds = Math.floor(newValue /1000 % 60).toString().padStart(2, '0');
	display.nowtime = `${minutes}:${seconds}`;
	if (!isProgressDragging) {
		display.progress = (newValue / state.endTime) * 100;
	}
})

watch(() => state.isPlay, (newValue) => {
	if (!isProgressDragging) {
		state.isPlay = newValue;
		display.scale = newValue ? "scale(1)" : "scale(0.8)";
	}
})

watch(() => state.quality, (newValue) => {
	if (!isProgressDragging) {
		settagstr(newValue)
	}
})


</script>
