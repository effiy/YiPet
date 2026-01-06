(function() {
    'use strict';

    // 确保 PetManager 类已定义
    if (typeof window.PetManager === 'undefined') {
        console.error('PetManager 未定义，无法扩展 Calendar 模块');
        return;
    }

    const proto = window.PetManager.prototype;

    // ==================== 日历与日期筛选功能 ====================

    /**
     * 创建日历组件
     * 支持日期区间选择和折叠/展开功能
     */
    proto.createCalendarComponent = function() {
        const mainColor = PET_CONFIG?.theme?.primaryColor || '#6366f1';

        // 初始化日历月份（如果还没有设置）
        if (!this.calendarMonth) {
            const today = new Date();
            this.calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        }

        // 日历容器
        const calendarContainer = document.createElement('div');
        calendarContainer.className = 'date-range-calendar-container';
        calendarContainer.style.cssText = `
            width: 100% !important;
            margin-bottom: 8px !important;
            background: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            overflow: hidden !important;
            transition: all 0.3s ease !important;
        `;

        // 日历头部（折叠/展开按钮和日期显示）
        const calendarHeader = document.createElement('div');
        calendarHeader.style.cssText = `
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 8px 12px !important;
            background: #f9fafb !important;
            border-bottom: 1px solid #e5e7eb !important;
            cursor: pointer !important;
            user-select: none !important;
        `;

        // 左侧：图标和标题
        const headerLeft = document.createElement('div');
        headerLeft.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex: 1 !important;
        `;

        const calendarIcon = document.createElement('span');
        calendarIcon.textContent = '📅';
        calendarIcon.style.cssText = `
            font-size: 16px !important;
        `;

        // 日期区间显示和清除按钮容器
        const dateRangeContainer = document.createElement('div');
        dateRangeContainer.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            margin-left: 8px !important;
        `;

        const dateRangeDisplay = document.createElement('span');
        dateRangeDisplay.className = 'date-range-display';
        dateRangeDisplay.style.cssText = `
            font-size: 11px !important;
            color: #6b7280 !important;
        `;
        this.updateDateRangeDisplay(dateRangeDisplay);

        // 清除日期过滤按钮
        const clearDateBtn = document.createElement('button');
        clearDateBtn.innerHTML = '✕';
        clearDateBtn.className = 'clear-date-filter-btn';
        clearDateBtn.title = '清除日期筛选';
        clearDateBtn.style.cssText = `
            width: 16px !important;
            height: 16px !important;
            border: none !important;
            background: #e5e7eb !important;
            color: #6b7280 !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            display: ${this.dateRangeFilter ? 'flex' : 'none'} !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 10px !important;
            padding: 0 !important;
            transition: all 0.2s ease !important;
            line-height: 1 !important;
        `;

        clearDateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.dateRangeFilter = null;
            if (this.dateRangeDisplay) {
                this.updateDateRangeDisplay(this.dateRangeDisplay);
            }
            if (this.clearDateBtn) {
                this.clearDateBtn.style.display = 'none';
            }
            if (this.calendarDaysGrid && this.calendarMonth) {
                this.updateCalendarDays(this.calendarDaysGrid, this.calendarMonth);
            }
            // 应用日期过滤（清除后刷新列表）
            this.applyDateFilter();
        });

        clearDateBtn.addEventListener('mouseenter', () => {
            clearDateBtn.style.background = '#d1d5db';
            clearDateBtn.style.transform = 'scale(1.1)';
        });

        clearDateBtn.addEventListener('mouseleave', () => {
            clearDateBtn.style.background = '#e5e7eb';
            clearDateBtn.style.transform = 'scale(1)';
        });

        dateRangeContainer.appendChild(dateRangeDisplay);
        dateRangeContainer.appendChild(clearDateBtn);

        // 右侧容器：日期导航按钮组和折叠/展开按钮
        const headerRight = document.createElement('div');
        headerRight.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
        `;

        // 日期导航按钮组容器
        const dayNavContainer = document.createElement('div');
        dayNavContainer.className = 'day-navigation-container';
        dayNavContainer.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 2px !important;
            background: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            padding: 2px !important;
            margin-right: 8px !important;
        `;

        // 上一天快捷按钮
        const prevDayBtn = document.createElement('button');
        prevDayBtn.innerHTML = '◀';
        prevDayBtn.className = 'prev-day-btn';
        prevDayBtn.title = '上一天';
        prevDayBtn.style.cssText = `
            width: 24px !important;
            height: 24px !important;
            border: none !important;
            background: transparent !important;
            color: #6b7280 !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 12px !important;
            padding: 0 !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            line-height: 1 !important;
            position: relative !important;
        `;

        prevDayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const oldMonth = this.calendarMonth ? new Date(this.calendarMonth) : null;
            this.navigateDay(-1);
            if (this.dateRangeDisplay) {
                this.updateDateRangeDisplay(this.dateRangeDisplay);
            }
            if (this.clearDateBtn) {
                this.clearDateBtn.style.display = this.dateRangeFilter ? 'flex' : 'none';
            }
            // 如果月份改变了，更新月份标题
            if (oldMonth && this.calendarMonth &&
                (oldMonth.getFullYear() !== this.calendarMonth.getFullYear() ||
                 oldMonth.getMonth() !== this.calendarMonth.getMonth())) {
                if (this.calendarMonthTitle) {
                    this.updateMonthTitle(this.calendarMonthTitle, this.calendarMonth);
                }
            }
            if (this.calendarDaysGrid && this.calendarMonth) {
                this.updateCalendarDays(this.calendarDaysGrid, this.calendarMonth);
            }
            this.applyDateFilter();
        });

        prevDayBtn.addEventListener('mouseenter', () => {
            prevDayBtn.style.background = '#f3f4f6';
            prevDayBtn.style.color = mainColor;
            prevDayBtn.style.transform = 'scale(1.1)';
        });

        prevDayBtn.addEventListener('mouseleave', () => {
            prevDayBtn.style.background = 'transparent';
            prevDayBtn.style.color = '#6b7280';
            prevDayBtn.style.transform = 'scale(1)';
        });

        prevDayBtn.addEventListener('mousedown', () => {
            prevDayBtn.style.transform = 'scale(0.95)';
        });

        prevDayBtn.addEventListener('mouseup', () => {
            prevDayBtn.style.transform = 'scale(1.1)';
        });

        // 下一天快捷按钮
        const nextDayBtn = document.createElement('button');
        nextDayBtn.innerHTML = '▶';
        nextDayBtn.className = 'next-day-btn';
        nextDayBtn.title = '下一天';
        nextDayBtn.style.cssText = `
            width: 24px !important;
            height: 24px !important;
            border: none !important;
            background: transparent !important;
            color: #6b7280 !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 12px !important;
            padding: 0 !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            line-height: 1 !important;
            position: relative !important;
        `;

        nextDayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const oldMonth = this.calendarMonth ? new Date(this.calendarMonth) : null;
            this.navigateDay(1);
            if (this.dateRangeDisplay) {
                this.updateDateRangeDisplay(this.dateRangeDisplay);
            }
            if (this.clearDateBtn) {
                this.clearDateBtn.style.display = this.dateRangeFilter ? 'flex' : 'none';
            }
            // 如果月份改变了，更新月份标题
            if (oldMonth && this.calendarMonth &&
                (oldMonth.getFullYear() !== this.calendarMonth.getFullYear() ||
                 oldMonth.getMonth() !== this.calendarMonth.getMonth())) {
                if (this.calendarMonthTitle) {
                    this.updateMonthTitle(this.calendarMonthTitle, this.calendarMonth);
                }
            }
            if (this.calendarDaysGrid && this.calendarMonth) {
                this.updateCalendarDays(this.calendarDaysGrid, this.calendarMonth);
            }
            this.applyDateFilter();
        });

        nextDayBtn.addEventListener('mouseenter', () => {
            nextDayBtn.style.background = '#f3f4f6';
            nextDayBtn.style.color = mainColor;
            nextDayBtn.style.transform = 'scale(1.1)';
        });

        nextDayBtn.addEventListener('mouseleave', () => {
            nextDayBtn.style.background = 'transparent';
            nextDayBtn.style.color = '#6b7280';
            nextDayBtn.style.transform = 'scale(1)';
        });

        nextDayBtn.addEventListener('mousedown', () => {
            nextDayBtn.style.transform = 'scale(0.95)';
        });

        nextDayBtn.addEventListener('mouseup', () => {
            nextDayBtn.style.transform = 'scale(1.1)';
        });

        dayNavContainer.appendChild(prevDayBtn);
        dayNavContainer.appendChild(nextDayBtn);

        // 右侧：折叠/展开按钮
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'calendar-toggle-btn';
        toggleBtn.textContent = this.calendarCollapsed ? '▶' : '▼';
        toggleBtn.style.cssText = `
            font-size: 12px !important;
            color: #6b7280 !important;
            transition: transform 0.3s ease !important;
            cursor: pointer !important;
        `;

        headerRight.appendChild(dayNavContainer);
        headerRight.appendChild(toggleBtn);

        headerLeft.appendChild(calendarIcon);
        headerLeft.appendChild(dateRangeContainer);
        calendarHeader.appendChild(headerLeft);
        calendarHeader.appendChild(headerRight);

        // 日历内容区域
        const calendarContent = document.createElement('div');
        calendarContent.className = 'calendar-content';
        calendarContent.style.cssText = `
            display: ${this.calendarCollapsed ? 'none' : 'block'} !important;
            padding: 12px !important;
        `;

        // 创建日历主体
        const calendarBody = this.createCalendarBody();
        calendarContent.appendChild(calendarBody);

        // 折叠/展开功能
        const toggleCalendar = () => {
            this.calendarCollapsed = !this.calendarCollapsed;
            calendarContent.style.display = this.calendarCollapsed ? 'none' : 'block';
            toggleBtn.textContent = this.calendarCollapsed ? '▶' : '▼';
            toggleBtn.style.transform = this.calendarCollapsed ? 'rotate(0deg)' : 'rotate(0deg)';
            this.saveCalendarCollapsed();
        };

        calendarHeader.addEventListener('click', (e) => {
            if (e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
                toggleCalendar();
            }
        });

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCalendar();
        });

        calendarContainer.appendChild(calendarHeader);
        calendarContainer.appendChild(calendarContent);

        // 保存引用以便后续更新
        this.calendarContainer = calendarContainer;
        this.dateRangeDisplay = dateRangeDisplay;
        this.calendarContent = calendarContent;
        this.clearDateBtn = clearDateBtn;
        this.prevDayBtn = prevDayBtn;
        this.nextDayBtn = nextDayBtn;

        return calendarContainer;
    };

    /**
     * 创建日历主体（包含月份导航和日期网格）
     */
    proto.createCalendarBody = function() {
        const mainColor = PET_CONFIG?.theme?.primaryColor || '#6366f1';
        const today = new Date();
        const currentMonth = this.calendarMonth || new Date(today.getFullYear(), today.getMonth(), 1);

        // 日历主体容器
        const calendarBody = document.createElement('div');
        calendarBody.className = 'calendar-body';
        calendarBody.style.cssText = `
            width: 100% !important;
        `;

        // 月份导航
        const monthNav = document.createElement('div');
        monthNav.style.cssText = `
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            margin-bottom: 12px !important;
        `;

        const prevMonthBtn = document.createElement('button');
        prevMonthBtn.innerHTML = '‹';
        prevMonthBtn.style.cssText = `
            width: 28px !important;
            height: 28px !important;
            border: 1px solid #e5e7eb !important;
            background: #ffffff !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 18px !important;
            color: #374151 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
        `;

        const monthTitle = document.createElement('div');
        monthTitle.className = 'calendar-month-title';
        monthTitle.style.cssText = `
            font-size: 14px !important;
            font-weight: 600 !important;
            color: #374151 !important;
            flex: 1 !important;
            text-align: center !important;
        `;
        this.updateMonthTitle(monthTitle, currentMonth);

        const nextMonthBtn = document.createElement('button');
        nextMonthBtn.innerHTML = '›';
        nextMonthBtn.style.cssText = `
            width: 28px !important;
            height: 28px !important;
            border: 1px solid #e5e7eb !important;
            background: #ffffff !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 18px !important;
            color: #374151 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
        `;

        // 按钮悬停效果
        const addButtonHover = (btn) => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#f3f4f6';
                btn.style.borderColor = mainColor;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#ffffff';
                btn.style.borderColor = '#e5e7eb';
            });
        };
        addButtonHover(prevMonthBtn);
        addButtonHover(nextMonthBtn);

        // 月份切换
        prevMonthBtn.addEventListener('click', () => {
            const baseMonth = this.calendarMonth || currentMonth;
            const newMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1, 1);
            this.calendarMonth = newMonth;
            if (this.calendarDaysGrid) {
                this.updateCalendarDays(this.calendarDaysGrid, newMonth);
            }
            if (this.calendarMonthTitle) {
                this.updateMonthTitle(this.calendarMonthTitle, newMonth);
            }
        });

        nextMonthBtn.addEventListener('click', () => {
            const baseMonth = this.calendarMonth || currentMonth;
            const newMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
            this.calendarMonth = newMonth;
            if (this.calendarDaysGrid) {
                this.updateCalendarDays(this.calendarDaysGrid, newMonth);
            }
            if (this.calendarMonthTitle) {
                this.updateMonthTitle(this.calendarMonthTitle, newMonth);
            }
        });

        monthNav.appendChild(prevMonthBtn);
        monthNav.appendChild(monthTitle);
        monthNav.appendChild(nextMonthBtn);

        // 星期标题
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekdaysRow = document.createElement('div');
        weekdaysRow.style.cssText = `
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            gap: 2px !important;
            margin-bottom: 4px !important;
        `;

        weekdays.forEach(day => {
            const weekdayCell = document.createElement('div');
            weekdayCell.textContent = day;
            weekdayCell.style.cssText = `
                text-align: center !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                color: #6b7280 !important;
                padding: 4px 0 !important;
            `;
            weekdaysRow.appendChild(weekdayCell);
        });

        // 日期网格
        const calendarDaysGrid = document.createElement('div');
        calendarDaysGrid.className = 'calendar-days-grid';
        calendarDaysGrid.style.cssText = `
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            gap: 2px !important;
        `;

        this.updateCalendarDays(calendarDaysGrid, currentMonth);

        calendarBody.appendChild(monthNav);
        calendarBody.appendChild(weekdaysRow);
        calendarBody.appendChild(calendarDaysGrid);

        // 保存引用
        this.calendarMonthTitle = monthTitle;
        this.calendarDaysGrid = calendarDaysGrid;
        this.calendarMonth = currentMonth;

        return calendarBody;
    };

    /**
     * 更新月份标题
     */
    proto.updateMonthTitle = function(element, date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        element.textContent = `${year}年${month}月`;
    };

    /**
     * 更新日历日期网格
     */
    proto.updateCalendarDays = function(grid, month) {
        grid.innerHTML = '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const year = month.getFullYear();
        const monthIndex = month.getMonth();

        // 获取月份第一天和最后一天
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);

        // 获取第一天是星期几（0=周日）
        const firstDayWeek = firstDay.getDay();

        // 获取上个月的最后几天（用于填充第一周）
        const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();

        const mainColor = PET_CONFIG?.theme?.primaryColor || '#6366f1';
        const selectedStart = this.dateRangeFilter?.startDate;
        const selectedEnd = this.dateRangeFilter?.endDate;

        // 将主题色转换为RGB并添加透明度（在循环外部计算一次）
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        const rgb = hexToRgb(mainColor) || { r: 99, g: 102, b: 241 };
        const rangeBgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
        const rangeHoverBgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`;

        // 创建日期单元格
        for (let i = 0; i < 42; i++) {
            let date, isCurrentMonth, dayNumber;

            if (i < firstDayWeek) {
                // 上个月的日期
                dayNumber = prevMonthLastDay - firstDayWeek + i + 1;
                date = new Date(year, monthIndex - 1, dayNumber);
                isCurrentMonth = false;
            } else if (i < firstDayWeek + lastDay.getDate()) {
                // 当前月的日期
                dayNumber = i - firstDayWeek + 1;
                date = new Date(year, monthIndex, dayNumber);
                isCurrentMonth = true;
            } else {
                // 下个月的日期
                dayNumber = i - firstDayWeek - lastDay.getDate() + 1;
                date = new Date(year, monthIndex + 1, dayNumber);
                isCurrentMonth = false;
            }

            date.setHours(0, 0, 0, 0);

            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day-cell';
            dayCell.dataset.date = this.formatDate(date);

            // 判断日期状态
            const isToday = date.getTime() === today.getTime();
            const isSelected = this.isDateInRange(date, selectedStart, selectedEnd);
            const isStart = selectedStart && date.getTime() === selectedStart.getTime();
            const isEnd = selectedEnd && date.getTime() === selectedEnd.getTime();

            // 优化日期样式
            let textColor = isCurrentMonth ? '#374151' : '#d1d5db';
            let bgColor = 'transparent';
            let borderStyle = '';
            let fontWeight = 'normal';

            if (isStart || isEnd) {
                // 开始或结束日期：使用主题色背景，白色文字
                bgColor = mainColor;
                textColor = '#ffffff';
                fontWeight = '700';
                borderStyle = `border: 2px solid ${mainColor} !important;`;
                if (isToday) {
                    // 今天且是开始/结束日期：添加外圈边框突出显示
                    borderStyle = `border: 2px solid ${mainColor} !important; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8) inset, 0 0 0 1px ${mainColor} !important;`;
                }
            } else if (isSelected) {
                // 区间内的日期：使用主题色浅色背景
                bgColor = rangeBgColor;
                textColor = isCurrentMonth ? '#374151' : '#9ca3af';
                fontWeight = '500';
                if (isToday) {
                    // 今天且在区间内：添加边框
                    borderStyle = `border: 1.5px solid ${mainColor} !important;`;
                    textColor = mainColor;
                    fontWeight = '600';
                }
            } else if (isToday) {
                // 今天但未选中：使用浅色背景和边框
                bgColor = `${mainColor}20`;
                borderStyle = `border: 1.5px solid ${mainColor} !important;`;
                textColor = mainColor;
                fontWeight = '600';
            }

            dayCell.textContent = dayNumber;
            dayCell.style.cssText = `
                aspect-ratio: 1 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 12px !important;
                cursor: ${isCurrentMonth ? 'pointer' : 'default'} !important;
                border-radius: 4px !important;
                transition: all 0.2s ease !important;
                position: relative !important;
                color: ${textColor} !important;
                background: ${bgColor} !important;
                ${borderStyle}
                font-weight: ${fontWeight} !important;
                ${!isCurrentMonth ? 'opacity: 0.4 !important;' : ''}
            `;

            if (isCurrentMonth) {
                dayCell.addEventListener('click', () => {
                    this.handleDateClick(date);
                });

                dayCell.addEventListener('mouseenter', () => {
                    if (isStart || isEnd) {
                        // 开始/结束日期悬停：稍微加深
                        dayCell.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`;
                    } else if (isSelected) {
                        // 区间内日期悬停：加深背景
                        dayCell.style.background = rangeHoverBgColor;
                    } else {
                        // 未选中日期悬停：浅灰色背景
                        dayCell.style.background = '#f3f4f6';
                    }
                });

                dayCell.addEventListener('mouseleave', () => {
                    if (isStart || isEnd) {
                        dayCell.style.background = mainColor;
                    } else if (isSelected) {
                        dayCell.style.background = rangeBgColor;
                    } else if (isToday) {
                        dayCell.style.background = `${mainColor}20`;
                    } else {
                        dayCell.style.background = 'transparent';
                    }
                });
            }

            grid.appendChild(dayCell);
        }
    };

    /**
     * 处理日期点击
     */
    proto.handleDateClick = function(date) {
        // 确保日期的时间部分为 00:00:00，以便正确比较和显示
        const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (!this.dateRangeFilter) {
            // 开始选择日期区间，默认作为结束日期（支持筛选结束日期之前）
            this.dateRangeFilter = {
                startDate: null,
                endDate: normalizedDate
            };
        } else if (!this.dateRangeFilter.startDate && this.dateRangeFilter.endDate) {
            // 如果只有结束日期，现在选择开始日期
            const endDate = new Date(this.dateRangeFilter.endDate.getFullYear(), this.dateRangeFilter.endDate.getMonth(), this.dateRangeFilter.endDate.getDate());
            if (normalizedDate.getTime() > endDate.getTime()) {
                // 如果选择的日期晚于结束日期，交换它们
                this.dateRangeFilter = {
                    startDate: endDate,
                    endDate: normalizedDate
                };
            } else {
                this.dateRangeFilter.startDate = normalizedDate;
            }
        } else if (this.dateRangeFilter.startDate && !this.dateRangeFilter.endDate) {
            // 如果只有开始日期，现在选择结束日期
            const startDate = new Date(this.dateRangeFilter.startDate.getFullYear(), this.dateRangeFilter.startDate.getMonth(), this.dateRangeFilter.startDate.getDate());
            if (normalizedDate.getTime() < startDate.getTime()) {
                // 如果选择的日期早于开始日期，交换它们
                this.dateRangeFilter = {
                    startDate: normalizedDate,
                    endDate: startDate
                };
            } else {
                this.dateRangeFilter.endDate = normalizedDate;
            }
        } else {
            // 重新开始选择，默认作为结束日期
            this.dateRangeFilter = {
                startDate: null,
                endDate: normalizedDate
            };
        }

        // 更新日历显示
        if (this.calendarDaysGrid && this.calendarMonth) {
            this.updateCalendarDays(this.calendarDaysGrid, this.calendarMonth);
        }
        if (this.dateRangeDisplay) {
            this.updateDateRangeDisplay(this.dateRangeDisplay);
        }
        // 确保清除按钮显示
        if (this.clearDateBtn) {
            this.clearDateBtn.style.display = 'flex';
        }

        // 应用日期过滤
        this.applyDateFilter();
    };

    /**
     * 导航到上一天或下一天
     * @param {number} direction - 方向：-1 表示上一天，1 表示下一天
     */
    proto.navigateDay = function(direction) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let baseDate;

        if (this.dateRangeFilter) {
            // 如果有日期筛选，优先使用结束日期，如果没有则使用开始日期
            if (this.dateRangeFilter.endDate) {
                baseDate = new Date(this.dateRangeFilter.endDate);
            } else if (this.dateRangeFilter.startDate) {
                baseDate = new Date(this.dateRangeFilter.startDate);
            } else {
                baseDate = new Date(today);
            }
        } else {
            // 如果没有日期筛选，使用今天
            baseDate = new Date(today);
        }

        baseDate.setHours(0, 0, 0, 0);

        // 计算新日期
        const newDate = new Date(baseDate);
        newDate.setDate(newDate.getDate() + direction);
        newDate.setHours(0, 0, 0, 0);

        // 更新日期筛选
        // 如果之前有日期区间，保持区间结构但移动日期
        if (this.dateRangeFilter && this.dateRangeFilter.startDate && this.dateRangeFilter.endDate) {
            // 如果有完整的日期区间，计算区间长度并保持
            const rangeLength = Math.abs(this.dateRangeFilter.endDate.getTime() - this.dateRangeFilter.startDate.getTime());
            const daysDiff = Math.floor(rangeLength / (1000 * 60 * 60 * 24));

            if (this.dateRangeFilter.endDate.getTime() >= this.dateRangeFilter.startDate.getTime()) {
                // 正常区间：结束日期 >= 开始日期
                this.dateRangeFilter = {
                    startDate: new Date(newDate.getTime() - daysDiff * 24 * 60 * 60 * 1000),
                    endDate: newDate
                };
            } else {
                // 反向区间：结束日期 < 开始日期
                this.dateRangeFilter = {
                    startDate: newDate,
                    endDate: new Date(newDate.getTime() + daysDiff * 24 * 60 * 60 * 1000)
                };
            }
        } else if (this.dateRangeFilter && this.dateRangeFilter.startDate && !this.dateRangeFilter.endDate) {
            // 只有开始日期，移动开始日期
            this.dateRangeFilter = {
                startDate: newDate,
                endDate: null
            };
        } else {
            // 只有结束日期或没有日期筛选，设置为单日筛选（结束日期之前）
            this.dateRangeFilter = {
                startDate: null,
                endDate: newDate
            };
        }

        // 更新日历月份以显示新日期
        const newMonth = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
        if (!this.calendarMonth ||
            this.calendarMonth.getFullYear() !== newMonth.getFullYear() ||
            this.calendarMonth.getMonth() !== newMonth.getMonth()) {
            this.calendarMonth = newMonth;
            if (this.calendarMonthTitle) {
                this.updateMonthTitle(this.calendarMonthTitle, newMonth);
            }
        }
    };

    /**
     * 判断日期是否在区间内
     */
    proto.isDateInRange = function(date, startDate, endDate) {
        // 确保日期的时间部分为 00:00:00，以便正确比较
        const dateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

        if (startDate && endDate) {
            // 有开始和结束日期：判断是否在区间内（包含开始和结束日期）
            const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
            const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
            return dateTime >= startTime && dateTime <= endTime;
        } else if (startDate && !endDate) {
            // 只有开始日期：判断是否等于开始日期
            const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
            return dateTime === startTime;
        } else if (!startDate && endDate) {
            // 只有结束日期：判断是否在结束日期之前（不包含结束日期）
            const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
            return dateTime < endTime;
        }

        return false;
    };

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    proto.formatDate = function(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    };

    /**
     * 更新日期区间显示
     */
    proto.updateDateRangeDisplay = function(element) {
        if (!element) return;

        if (this.dateRangeFilter) {
            if (this.dateRangeFilter.startDate && this.dateRangeFilter.endDate) {
                // 有开始和结束日期
                const startStr = this.formatDate(this.dateRangeFilter.startDate);
                const endStr = this.formatDate(this.dateRangeFilter.endDate);
                element.textContent = `${startStr} ~ ${endStr}`;
            } else if (this.dateRangeFilter.startDate && !this.dateRangeFilter.endDate) {
                // 只有开始日期
                const startStr = this.formatDate(this.dateRangeFilter.startDate);
                element.textContent = `${startStr} ~ 选择结束日期`;
            } else if (!this.dateRangeFilter.startDate && this.dateRangeFilter.endDate) {
                // 只有结束日期（筛选结束日期之前）
                const endStr = this.formatDate(this.dateRangeFilter.endDate);
                element.textContent = `~ ${endStr}（之前）`;
            }
            // 显示清除按钮
            if (this.clearDateBtn) {
                this.clearDateBtn.style.display = 'flex';
            }
        } else {
            element.textContent = '';
            // 隐藏清除按钮
            if (this.clearDateBtn) {
                this.clearDateBtn.style.display = 'none';
            }
        }
    };

    /**
     * 应用日期过滤
     */
    proto.applyDateFilter = function() {
        // 根据当前模式决定更新哪个列表
        if (this.updateSessionSidebar) {
            this.updateSessionSidebar();
        }
    };

    /**
     * 加载日历折叠状态
     */
    proto.loadCalendarCollapsed = function() {
        try {
            const saved = localStorage.getItem('petCalendarCollapsed');
            if (saved !== null) {
                this.calendarCollapsed = saved === 'true';
            } else {
                // 如果没有保存的值，默认折叠
                this.calendarCollapsed = true;
            }
        } catch (error) {
            console.warn('加载日历折叠状态失败:', error);
            // 出错时也默认折叠
            this.calendarCollapsed = true;
        }
    };

    /**
     * 保存日历折叠状态
     */
    proto.saveCalendarCollapsed = function() {
        try {
            localStorage.setItem('petCalendarCollapsed', String(this.calendarCollapsed));
        } catch (error) {
            console.warn('保存日历折叠状态失败:', error);
        }
    };

})();

