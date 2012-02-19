require "delayed_job"

class FeedsController < ApplicationController
  respond_to :html, :json
  before_filter :authenticate_user!

  def index
    respond_with(@feeds = current_user.feeds.all)
  end

  def show
    respond_with(@feed = Feed.find(params[:id]))
  end

  def new
    @feed = Feed.new
  end

  def create
    @feed = Feed.new(params[:feed])
    @feed.user = current_user

    respond_to do |format|
      if @feed.save
        # Import memories from the feed later wth delayed_job
        @feed.send_later(:import_memories)
        format.html {
          redirect_to(@feed, :notice => 'Feed was successfully created.')
        }
      else
        format.html { render :action => "new" }
      end
    end
  end

  def edit
  end

  def update
  end

  def destroy
  end
end
